use clap::Parser;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use walkdir::WalkDir;

#[derive(Serialize, Debug, Clone)]
struct MethodInfo {
    name: String,
    unique_id: String,
    start_line: usize,
    end_line: usize,
    content_hash: String,
    calls: Vec<String>,
    loc: usize, // Lines of Code
    cyclomatic_complexity: usize,
}

#[derive(Serialize, Debug, Clone)]
struct ClassInfo {
    name: String,
    start_line: usize,
    end_line: usize,
    methods: Vec<MethodInfo>,
    structure_hash: String,
}

#[derive(Serialize, Debug)]
struct FileAnalysis {
    path: String,
    functions: Vec<MethodInfo>,
    classes: Vec<ClassInfo>,
    structure_hash: String,
}

#[derive(Serialize, Debug)]
struct RepoAnalysis {
    files: Vec<FileAnalysis>,
    root_merkle_hash: String,
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long)]
    dir_path: String,
}
fn calculate_loc(node_text: &str) -> usize {
    let mut count = 0;
    for line in node_text.lines() {
        let trimmed_line = line.trim();
        if !trimmed_line.is_empty() && !trimmed_line.starts_with('#') {
            count += 1;
        }
    }
    count
}
fn calculate_cyclomatic_complexity_recursive(node: &tree_sitter::Node, complexity: &mut usize) {
    match node.kind() {
        "if_statement" | "while_statement" | "for_statement" | 
        "elif_clause" | // Elif is a decision point
        "except_clause" | // Each except block is a path
        "assert_statement" | // Assert can be considered a decision point
        "raise_statement" | // Raise alters control flow
        "boolean_operator" | // 'and', 'or' in conditions add complexity
        "comparison_operator" | // Each comparison is part of a decision
        "conditional_expression" | // ternary operator (x if C else y)
        "list_comprehension" | // if it contains an 'if' clause
        "generator_expression" | // if it contains an 'if' clause
        "dictionary_comprehension" // if it contains an 'if' clause
         => {
            *complexity += 1;
            // For boolean_operator like 'and'/'or', each one adds to complexity.
            // If a node has multiple 'and' or 'or' children, this simple match might undercount.
            // A more robust way for 'and'/'or' is to count them if they are children of a condition.
            // For list comprehensions with 'if', we need to check for the 'if_clause' child.
            if node.kind() == "list_comprehension" || node.kind() == "generator_expression" || node.kind() == "dictionary_comprehension" {
                if node.child_by_field_name("if_clauses").is_some() || node.children(&mut node.walk()).any(|c| c.kind() == "if_clause") {
                    // Already counted the comprehension itself, the 'if' adds another path.
                    // This might double count if the 'if_clause' itself is a decision point.
                    // A simpler approach is to count specific boolean keywords.
                }
            }
        }
        // Handle 'else' carefully: it's part of an 'if' structure.
        // The initial 'if' counts as 1. An 'else' doesn't add another *decision point* by itself,
        // but it does define an alternative path. Standard CC often counts the 'if' and assumes 'else' is covered.
        // Some tools count 'else' if it's not just a pass-through.
        // For simplicity, we are counting constructs that introduce branching.
        _ => {}
    }

    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            calculate_cyclomatic_complexity_recursive(&child, complexity);
        }
    }
}

fn calculate_cyclomatic_complexity(function_body_node: &tree_sitter::Node) -> usize {
    let mut complexity = 1; // Start with 1 for the single path through the function if no decisions
    calculate_cyclomatic_complexity_recursive(function_body_node, &mut complexity);
    complexity
}
/// Recursively traverses a node to find all 'call' expressions.
fn find_calls_recursive(node: &tree_sitter::Node, code: &str, calls: &mut Vec<String>) {
    if node.kind() == "call" {
        if let Some(func_node) = node.child_by_field_name("function") {
            let callee_name = func_node
                .utf8_text(code.as_bytes())
                .unwrap_or("")
                .to_string();
            if let Some(final_name) = callee_name.split('.').last() {
                if !final_name.is_empty() {
                    calls.push(final_name.to_string());
                }
            }
        }
    }
    for child in node.children(&mut node.walk()) {
        find_calls_recursive(&child, code, calls);
    }
}

/// Helper to parse a function node, requiring file and optional class context.
fn parse_function_node(
    node: &tree_sitter::Node,
    code: &str,
    file_path: &str,
    containing_class_name: Option<&str>,
) -> Option<MethodInfo> {
    let actual_function_node = if node.kind() == "decorated_definition" {
        // This is the outer cursor for the first `find` attempt.
        let mut cursor = node.walk();

        // Perform the first find in its own scope to manage iterator lifetime.
        let primary_find_result: Option<tree_sitter::Node> = {
            let mut children_iter = node.children(&mut cursor);
            children_iter.find(|child| {
                child.kind() == "function_definition" || child.kind() == "async_function_definition"
            })
            // children_iter is dropped here. cursor is still alive.
        };

        // Now, use or_else. The closure for or_else will manage its own cursor.
        let option_node = primary_find_result.or_else(|| {
            // fallback_cursor is local to this closure.
            let mut fallback_cursor = node.walk(); // Use a new cursor for the fallback
            let fallback_find_result: Option<tree_sitter::Node> = {
                let mut fallback_children_iter = node.children(&mut fallback_cursor);
                fallback_children_iter.find(|child| child.kind().ends_with("definition"))
                // fallback_children_iter is dropped here. fallback_cursor is still alive.
            };
            // fallback_cursor is dropped when this closure ends.
            fallback_find_result
        });
        // cursor (the outer one) is dropped when this `if` block's scope ends.

        option_node.unwrap_or(*node) // Fallback to the original node if nothing found
    } else {
        *node // If not a decorated_definition, use the node itself.
    };

    // ... (rest of parse_function_node remains the same)
    if let Some(name_node) = actual_function_node.child_by_field_name("name") {
        let name = name_node
            .utf8_text(code.as_bytes())
            .unwrap_or("")
            .to_string();

        let unique_id = format!(
            "{}:{}{}",
            file_path,
            containing_class_name
                .map(|cn| format!("{}::", cn))
                .unwrap_or_default(),
            name
        );

        let function_full_text = node.utf8_text(code.as_bytes()).unwrap_or("").to_string();
        let mut hasher = Sha256::new();
        hasher.update(function_full_text.as_bytes());
        let content_hash = format!("{:x}", hasher.finalize());

        let mut calls: Vec<String> = Vec::new();
        if let Some(body_node) = actual_function_node.child_by_field_name("body") {
            find_calls_recursive(&body_node, code, &mut calls);
            let function_node_text_for_loc = actual_function_node
                .utf8_text(code.as_bytes())
                .unwrap_or("");
            let loc = calculate_loc(function_node_text_for_loc);
            let cyclomatic_complexity = calculate_cyclomatic_complexity(&body_node);

            return Some(MethodInfo {
                name,
                unique_id,
                start_line: node.start_position().row + 1,
                end_line: node.end_position().row + 1,
                content_hash,
                calls,
                loc,
                cyclomatic_complexity,
            });
        } else {
            let function_node_text_for_loc = actual_function_node
                .utf8_text(code.as_bytes())
                .unwrap_or("");
            let loc = calculate_loc(function_node_text_for_loc);

            return Some(MethodInfo {
                name,
                unique_id,
                start_line: node.start_position().row + 1,
                end_line: node.end_position().row + 1,
                content_hash,
                calls, // Will be empty
                loc,
                cyclomatic_complexity: 1,
            });
        }
    }
    None
}
/// Helper to handle decorated definitions, passing context through.
fn extract_function_from_decorated(
    node: &tree_sitter::Node,
    code: &str,
    file_path: &str,
    class_name: Option<&str>,
) -> Option<MethodInfo> {
    if let Some(definition_node) = node.child_by_field_name("definition") {
        if definition_node.kind() == "function_definition" {
            return parse_function_node(&definition_node, code, file_path, class_name);
        }
    }
    None
}

/// Helper to parse a class node, including its methods.
fn parse_class_node(node: &tree_sitter::Node, code: &str, file_path: &str) -> Option<ClassInfo> {
    if let Some(name_node) = node.child_by_field_name("name") {
        let name = name_node
            .utf8_text(code.as_bytes())
            .unwrap_or("")
            .to_string();
        let mut methods_in_class: Vec<MethodInfo> = Vec::new();

        if let Some(body_node) = node.child_by_field_name("body") {
            let mut cursor = body_node.walk();
            for child_node in body_node.children(&mut cursor) {
                // Handle direct function definitions and async function definitions
                if child_node.kind() == "function_definition"
                    || child_node.kind() == "async_function_definition"
                {
                    // The fix for E0061 (changing parse_function_node's signature) will make this call valid.
                    if let Some(method_info) =
                        parse_function_node(&child_node, code, file_path, Some(&name))
                    {
                        methods_in_class.push(method_info);
                    }
                }
                // Handle decorated definitions (which could be methods)
                if child_node.kind() == "decorated_definition" {
                    // extract_function_from_decorated expects the decorated_definition node.
                    // It will then call parse_function_node with the inner function_definition.
                    // The fix for E0061 (changing parse_function_node's signature) makes the inner call in extract_function_from_decorated valid.
                    if let Some(method_info) =
                        extract_function_from_decorated(&child_node, code, file_path, Some(&name))
                    {
                        methods_in_class.push(method_info);
                    }
                }
            }
        }

        let mut combined_method_hashes = String::new();
        methods_in_class.sort_by(|a, b| a.name.cmp(&b.name));
        for method in &methods_in_class {
            combined_method_hashes.push_str(&method.content_hash);
        }
        let mut class_hasher = Sha256::new();
        class_hasher.update(combined_method_hashes);
        let structure_hash = format!("{:x}", class_hasher.finalize());

        return Some(ClassInfo {
            name,
            start_line: node.start_position().row + 1,
            end_line: node.end_position().row + 1,
            methods: methods_in_class,
            structure_hash,
        });
    }
    None
}
fn main() {
    let args = Args::parse();
    let mut parser = tree_sitter::Parser::new();
    parser
        .set_language(&tree_sitter_python::language())
        .expect("Error loading Python grammar");

    let mut all_analyzed_files: Vec<FileAnalysis> = Vec::new();

    for entry in WalkDir::new(&args.dir_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("py") {
            let code_string = match fs::read_to_string(path) {
                Ok(content) => content,
                Err(_) => continue,
            };

            if let Some(tree) = parser.parse(&code_string, None) {
                let root_node = tree.root_node();
                let mut top_level_functions: Vec<MethodInfo> = Vec::new();
                let mut classes_in_file: Vec<ClassInfo> = Vec::new();
                let relative_path = path.strip_prefix(&args.dir_path).unwrap_or(path);
                let relative_path_str = relative_path.to_str().unwrap_or("");

                let mut cursor = root_node.walk();
                for node in root_node.children(&mut cursor) {
                    // Handle direct function definitions and async function definitions
                    if node.kind() == "function_definition"
                        || node.kind() == "async_function_definition"
                    {
                        // The fix for E0061 (changing parse_function_node's signature) will make this call valid.
                        if let Some(func_info) =
                            parse_function_node(&node, &code_string, relative_path_str, None)
                        {
                            top_level_functions.push(func_info);
                        }
                    }
                    // Handle decorated definitions (which could be top-level functions or classes)
                    if node.kind() == "decorated_definition" {
                        // Check if it's a decorated function
                        if let Some(definition_child) = node.child_by_field_name("definition") {
                            if definition_child.kind() == "function_definition"
                                || definition_child.kind() == "async_function_definition"
                            {
                                if let Some(func_info) = extract_function_from_decorated(
                                    &node,
                                    &code_string,
                                    relative_path_str,
                                    None,
                                ) {
                                    top_level_functions.push(func_info);
                                }
                            } else if definition_child.kind() == "class_definition" {
                                // If it's a decorated class, parse it using parse_class_node with the inner class_definition node
                                if let Some(class_info) = parse_class_node(
                                    &definition_child,
                                    &code_string,
                                    relative_path_str,
                                ) {
                                    classes_in_file.push(class_info);
                                }
                            }
                        }
                    }
                    // Handle non-decorated class definitions
                    if node.kind() == "class_definition" {
                        if let Some(class_info) =
                            parse_class_node(&node, &code_string, relative_path_str)
                        {
                            classes_in_file.push(class_info);
                        }
                    }
                }

                // ... (rest of main remains the same)
                let mut combined_child_hashes = String::new();
                top_level_functions.sort_by(|a, b| a.name.cmp(&b.name));
                for func in &top_level_functions {
                    combined_child_hashes.push_str(&func.content_hash);
                }
                classes_in_file.sort_by(|a, b| a.name.cmp(&b.name));
                for class in &classes_in_file {
                    combined_child_hashes.push_str(&class.structure_hash);
                }
                let mut file_hasher = Sha256::new();
                file_hasher.update(combined_child_hashes);
                let file_structure_hash = format!("{:x}", file_hasher.finalize());

                all_analyzed_files.push(FileAnalysis {
                    path: relative_path_str.to_string(),
                    functions: top_level_functions,
                    classes: classes_in_file,
                    structure_hash: file_structure_hash,
                });
            }
        }
    }

    let mut combined_file_hashes = String::new();
    all_analyzed_files.sort_by(|a, b| a.path.cmp(&b.path));
    for file in &all_analyzed_files {
        combined_file_hashes.push_str(&file.structure_hash);
    }
    let mut root_hasher = Sha256::new();
    root_hasher.update(combined_file_hashes);
    let root_merkle_hash = format!("{:x}", root_hasher.finalize());

    let repo_analysis = RepoAnalysis {
        files: all_analyzed_files,
        root_merkle_hash,
    };

    match serde_json::to_string_pretty(&repo_analysis) {
        Ok(json_output) => println!("{}", json_output),
        Err(e) => eprintln!("Error serializing to JSON: {}", e),
    }
}
