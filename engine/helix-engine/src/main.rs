use clap::Parser;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::process::Command;
use walkdir::WalkDir;

use tree_sitter::{Node, Point};

#[derive(Serialize, Debug, Clone)]
struct Location {
    line: usize,
    column: usize,
}
#[derive(Serialize, Debug, Clone)]
struct MethodInfo {
    name: String,
    unique_id: String,
    start_line: usize,
    end_line: usize,
    content_hash: String,
    calls: Vec<String>,
    loc: usize,
    cyclomatic_complexity: usize,
    docstring: Option<String>,
    signature_end_location: Location,
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
    imports: Vec<String>,
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

fn parse_import_statement(node: &Node, code: &str) -> Vec<String> {
    let mut modules = Vec::new();
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "dotted_name" || child.kind() == "aliased_import" {
            if let Ok(module_name) = child
                .child_by_field_name("name")
                .unwrap_or(child)
                .utf8_text(code.as_bytes())
            {
                modules.push(module_name.to_string());
            }
        }
    }
    modules
}
fn unindent_docstring(doc: &str) -> String {
    let lines: Vec<&str> = doc.lines().collect();
    if lines.is_empty() {
        return String::new();
    }

    // Find the minimum indentation of non-empty lines
    let min_indent = lines
        .iter()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.chars().take_while(|&c| c.is_whitespace()).count())
        .min()
        .unwrap_or(0);

    lines
        .iter()
        .map(|line| {
            if line.len() > min_indent {
                &line[min_indent..]
            } else {
                line.trim_start()
            }
        })
        .collect::<Vec<&str>>()
        .join("\n")
}

// --- NEW HELPER: Extracts docstring from a function/method body ---
fn extract_docstring(body_node: &Node, code: &str) -> Option<String> {
    let first_child = body_node.named_child(0)?;

    if first_child.kind() == "expression_statement" {
        let string_node = first_child.named_child(0)?;
        if string_node.kind() == "string" {
            let raw_doc = string_node.utf8_text(code.as_bytes()).ok()?;

            // Remove the triple quotes
            let content_part = raw_doc
                .trim_start_matches("'''")
                .trim_start_matches("\"\"\"")
                .trim_end_matches("'''")
                .trim_end_matches("\"\"\"");

            return Some(unindent_docstring(content_part.trim()));
        }
    }
    None
}

fn parse_import_from_statement(node: &Node, code: &str) -> Vec<String> {
    let mut modules = Vec::new();
    if let Some(module_node) = node.child_by_field_name("module_name") {
        if let Ok(module_name) = module_node.utf8_text(code.as_bytes()) {
            modules.push(module_name.to_string());
        }
    }
    modules
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
        "if_statement"
        | "while_statement"
        | "for_statement"
        | "elif_clause"
        | "except_clause"
        | "assert_statement"
        | "raise_statement"
        | "boolean_operator"
        | "comparison_operator"
        | "conditional_expression"
        | "list_comprehension"
        | "generator_expression"
        | "dictionary_comprehension" => {
            *complexity += 1;

            if node.kind() == "list_comprehension"
                || node.kind() == "generator_expression"
                || node.kind() == "dictionary_comprehension"
            {
                if node.child_by_field_name("if_clauses").is_some()
                    || node
                        .children(&mut node.walk())
                        .any(|c| c.kind() == "if_clause")
                {}
            }
        }

        _ => {}
    }

    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            calculate_cyclomatic_complexity_recursive(&child, complexity);
        }
    }
}

fn calculate_cyclomatic_complexity(function_body_node: &tree_sitter::Node) -> usize {
    let mut complexity = 1;
    calculate_cyclomatic_complexity_recursive(function_body_node, &mut complexity);
    complexity
}

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

fn parse_function_node(
    node: &tree_sitter::Node,
    code: &str,
    file_path: &str,
    containing_class_name: Option<&str>,
) -> Option<MethodInfo> {
    let actual_function_node = if node.kind() == "decorated_definition" {
        let mut cursor = node.walk();

        let primary_find_result: Option<tree_sitter::Node> = {
            let mut children_iter = node.children(&mut cursor);
            children_iter.find(|child| {
                child.kind() == "function_definition" || child.kind() == "async_function_definition"
            })
        };

        let option_node = primary_find_result.or_else(|| {
            let mut fallback_cursor = node.walk();
            let fallback_find_result: Option<tree_sitter::Node> = {
                let mut fallback_children_iter = node.children(&mut fallback_cursor);
                fallback_children_iter.find(|child| child.kind().ends_with("definition"))
            };

            fallback_find_result
        });

        option_node.unwrap_or(*node)
    } else {
        *node
    };

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
            let docstring = extract_docstring(&body_node, code);

            // The signature ends at the colon ':'
            let colon_node = actual_function_node
                .children(&mut actual_function_node.walk())
                .find(|n| n.kind() == ":")
                .unwrap_or(actual_function_node); // Fallback
            let end_pos: Point = colon_node.end_position();
            let signature_end_location = Location {
                line: end_pos.row + 1,
                column: end_pos.column + 1,
            };
            return Some(MethodInfo {
                name,
                unique_id,
                start_line: node.start_position().row + 1,
                end_line: node.end_position().row + 1,
                content_hash,
                calls,
                loc,
                cyclomatic_complexity,
                docstring, // Add to struct
                signature_end_location,
            });
        } else {
            // Handle functions with no body (e.g., in abstract classes)
            let loc = calculate_loc(&function_full_text);
            let signature_end_location = Location {
                line: node.end_position().row + 1,
                column: node.end_position().column + 1,
            };
            return Some(MethodInfo {
                name,
                unique_id,
                start_line: node.start_position().row + 1,
                end_line: node.end_position().row + 1,
                content_hash,
                calls, // Will be empty
                loc,
                cyclomatic_complexity: 1,
                docstring: None,
                signature_end_location,
            });
        }
    }
    None
}

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
                if child_node.kind() == "function_definition"
                    || child_node.kind() == "async_function_definition"
                {
                    if let Some(method_info) =
                        parse_function_node(&child_node, code, file_path, Some(&name))
                    {
                        methods_in_class.push(method_info);
                    }
                }

                if child_node.kind() == "decorated_definition" {
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

    // --- FIX 2: Get the absolute path for the source root ---
    let absolute_dir_path = fs::canonicalize(&args.dir_path)
        .expect("Failed to get absolute path for the provided directory");

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
                let mut raw_imports_in_file: Vec<String> = Vec::new(); // Store raw imports here
                let relative_path = path.strip_prefix(&args.dir_path).unwrap_or(path);
                let relative_path_str = relative_path.to_str().unwrap_or("");

                let mut cursor = root_node.walk();
                for node in root_node.children(&mut cursor) {
                    // Extract RAW import strings
                    if node.kind() == "import_statement" {
                        raw_imports_in_file.extend(parse_import_statement(&node, &code_string));
                    }
                    if node.kind() == "import_from_statement" {
                        raw_imports_in_file
                            .extend(parse_import_from_statement(&node, &code_string));
                    }

                    if node.kind() == "function_definition"
                        || node.kind() == "async_function_definition"
                    {
                        if let Some(func_info) =
                            parse_function_node(&node, &code_string, relative_path_str, None)
                        {
                            top_level_functions.push(func_info);
                        }
                    }

                    if node.kind() == "decorated_definition" {
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

                    if node.kind() == "class_definition" {
                        if let Some(class_info) =
                            parse_class_node(&node, &code_string, relative_path_str)
                        {
                            classes_in_file.push(class_info);
                        }
                    }
                }
                let resolved_imports: Vec<String> = if !raw_imports_in_file.is_empty() {
                    let raw_imports_json = serde_json::to_string(&raw_imports_in_file)
                        .unwrap_or_else(|_| "[]".to_string());

                    // Assumes the script is in a 'scripts' directory relative to the executable
                    let script_path = "/app/scripts/resolve_imports.py";

                    let output = Command::new("python3")
                        .arg(script_path)
                        .arg(&absolute_dir_path) // Pass the absolute path of the repo as the source_root
                        .arg(relative_path_str) // Pass the file path relative to the source_root
                        .arg(&raw_imports_json)
                        .output()
                        .expect("Failed to execute Python import resolver script");

                    if output.status.success() {
                        // Parse the JSON array from the script's stdout
                        serde_json::from_slice(&output.stdout).unwrap_or_else(|err| {
                            eprintln!(
                                "Error parsing JSON from Python script for {}: {}",
                                relative_path_str, err
                            );
                            raw_imports_in_file // Fallback to raw imports on JSON error
                        })
                    } else {
                        eprintln!(
                            "Python script failed for {}: {}",
                            relative_path_str,
                            String::from_utf8_lossy(&output.stderr)
                        );
                        raw_imports_in_file // Fallback to raw imports on script error
                    }
                } else {
                    vec![]
                };

                let mut combined_child_hashes = String::new();
                top_level_functions.sort_by(|a, b| a.name.cmp(&b.name));
                for func in &top_level_functions {
                    combined_child_hashes.push_str(&func.content_hash);
                }
                classes_in_file.sort_by(|a, b| a.name.cmp(&b.name));
                for class in &classes_in_file {
                    combined_child_hashes.push_str(&class.structure_hash);
                }

                // Create a mutable copy to sort for consistent hashing
                let mut sorted_imports = resolved_imports.clone();
                sorted_imports.sort();
                for import_str in &sorted_imports {
                    combined_child_hashes.push_str(import_str);
                }
                let mut file_hasher = Sha256::new();
                file_hasher.update(combined_child_hashes);
                let file_structure_hash = format!("{:x}", file_hasher.finalize());

                all_analyzed_files.push(FileAnalysis {
                    path: relative_path_str.to_string(),
                    functions: top_level_functions,
                    classes: classes_in_file,
                    imports: resolved_imports,
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
