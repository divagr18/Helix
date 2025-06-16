// engine/helix-engine/src/main.rs

use clap::Parser;
use std::fs;
use walkdir::WalkDir;
use serde::Serialize;

#[derive(Serialize, Debug)]
struct FunctionInfo {
    name: String,
    start_line: usize,
    end_line: usize,
}

#[derive(Serialize, Debug)]
struct FileAnalysis {
    path: String,
    functions: Vec<FunctionInfo>,
}

#[derive(Serialize, Debug)]
struct RepoAnalysis {
    files: Vec<FileAnalysis>,
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to the DIRECTORY to parse
    #[arg(short, long)]
    dir_path: String,
}

fn main() {
    let args = Args::parse();

    let mut parser = tree_sitter::Parser::new();
    parser.set_language(&tree_sitter_python::language()).expect("Error loading Python grammar");

    let mut analyzed_files: Vec<FileAnalysis> = Vec::new();

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
                let mut functions_in_file: Vec<FunctionInfo> = Vec::new();

                let mut cursor = root_node.walk();
                for node in root_node.children(&mut cursor) {
                    if node.kind() == "function_definition" {
                        if let Some(name_node) = node.child_by_field_name("name") {
                            let function_name = name_node
                                .utf8_text(&code.as_bytes())
                                .unwrap_or("")
                                .to_string();

                            let new_function = FunctionInfo {
                                name: function_name,
                                start_line: node.start_position().row + 1,
                                end_line: node.end_position().row + 1,
                            };
                            functions_in_file.push(new_function);
                        }
                    }
                }

                let file_analysis = FileAnalysis {
                    path: path.to_str().unwrap_or("").to_string(),
                    functions: functions_in_file,
                };
                analyzed_files.push(file_analysis);
            }
        }
    }

    let repo_analysis = RepoAnalysis {
        files: analyzed_files,
    };

    match serde_json::to_string_pretty(&repo_analysis) {
        Ok(json_output) => println!("{}", json_output),
        Err(e) => eprintln!("Error serializing to JSON: {}", e),
    }
}
