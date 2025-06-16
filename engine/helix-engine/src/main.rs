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
    class_name: Option<&str>,
) -> Option<MethodInfo> {
    if let Some(name_node) = node.child_by_field_name("name") {
        let name = name_node
            .utf8_text(code.as_bytes())
            .unwrap_or("")
            .to_string();
        let content = node.utf8_text(code.as_bytes()).unwrap_or("").to_string();

        let mut hasher = Sha256::new();
        hasher.update(&content);
        let content_hash = format!("{:x}", hasher.finalize());

        let mut calls: Vec<String> = Vec::new();
        if let Some(body_node) = node.child_by_field_name("body") {
            find_calls_recursive(&body_node, code, &mut calls);
        }

        let unique_id = match class_name {
            Some(c_name) => format!("{}::{}::{}", file_path, c_name, name),
            None => format!("{}::{}", file_path, name),
        };

        return Some(MethodInfo {
            name,
            unique_id,
            start_line: node.start_position().row + 1,
            end_line: node.end_position().row + 1,
            content_hash,
            calls,
        });
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
                if child_node.kind() == "function_definition" {
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

    for entry in WalkDir::new(&args.dir_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("py") {
            let code = match fs::read_to_string(path) {
                Ok(content) => content,
                Err(_) => continue,
            };

            if let Some(tree) = parser.parse(&code, None) {
                let root_node = tree.root_node();
                let mut top_level_functions: Vec<MethodInfo> = Vec::new();
                let mut classes_in_file: Vec<ClassInfo> = Vec::new();
                let relative_path = path.strip_prefix(&args.dir_path).unwrap_or(path);
                let relative_path_str = relative_path.to_str().unwrap_or("");

                let mut cursor = root_node.walk();
                for node in root_node.children(&mut cursor) {
                    if node.kind() == "function_definition" {
                        if let Some(func_info) =
                            parse_function_node(&node, &code, relative_path_str, None)
                        {
                            top_level_functions.push(func_info);
                        }
                    }
                    if node.kind() == "decorated_definition" {
                        if let Some(func_info) =
                            extract_function_from_decorated(&node, &code, relative_path_str, None)
                        {
                            top_level_functions.push(func_info);
                        }
                    }
                    if node.kind() == "class_definition" {
                        if let Some(class_info) = parse_class_node(&node, &code, relative_path_str)
                        {
                            classes_in_file.push(class_info);
                        }
                    }
                }

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
