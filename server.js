const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dirTree = require('directory-tree');
const fs = require('fs');
const esprima = require('esprima');
const { exec } = require('child_process'); // Added for executing commands

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get project structure
app.post('/api/project-structure', (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    // Generate directory tree, requesting type, size, and extension attributes
    const filteredTree = dirTree(projectPath, { 
      exclude: /node_modules|.git/,
      attributes: ['type', 'size', 'extension'] // Request necessary attributes
    });
    
    // Analyze dependencies
    const dependencies = analyzeDependencies(filteredTree);
    
    res.json({
      structure: filteredTree,
      dependencies
    });
  } catch (error) {
    console.error('Error analyzing project structure:', error);
    res.status(500).json({ error: 'Failed to analyze project structure' });
  }
});

// API endpoint to open a file in VS Code
app.post('/api/open-file', (req, res) => {
  const { filePath } = req.body;

  if (!filePath) {
    console.error('File path is missing in the request body.');
    return res.status(400).json({ error: 'File path is required' });
  }

  // Basic validation: Check if the path seems plausible (optional, adjust as needed)
  // For security, ensure the path is absolute or resolve it securely if relative paths are expected.
  // Here, we assume the path provided by the frontend is the absolute path obtained from dirTree.
  if (!path.isAbsolute(filePath)) {
     // If paths are relative to the analyzed project, resolve them first.
     // This example assumes absolute paths are sent from the frontend.
     // If not, you'd need the original projectPath context here.
     console.warn(`Received non-absolute path: ${filePath}. Attempting to open anyway.`);
     // return res.status(400).json({ error: 'Invalid file path provided. Absolute path expected.' });
  }

  // Construct the command to open the file in VS Code
  // Using quotes around filePath handles paths with spaces
  const command = `code "${filePath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command "${command}": ${error.message}`); // Log error message
      console.error(`stderr: ${stderr}`);
      // Check if the error is because 'code' command is not found
      if (error.message.includes('is not recognized') || error.message.includes('command not found')) {
         return res.status(500).json({ error: `Failed to open file. Make sure the 'code' command is available in your system's PATH.` });
      }
      return res.status(500).json({ error: `Failed to open file: ${error.message}` });
    }
    // Removed success log
    res.status(200).json({ message: 'File open request sent successfully' });
  });
});


// Function to analyze dependencies between files
function analyzeDependencies(tree) {
  const dependencies = [];
  const jsFiles = [];
  
  // Collect all JS files
  function collectJsFiles(node) {
    if (node.type === 'file' && node.extension === '.js') {
      jsFiles.push(node.path);
    } else if (node.type === 'directory' && node.children) {
      node.children.forEach(child => collectJsFiles(child));
    }
  }
  
  collectJsFiles(tree);
  
  // Analyze each JS file for imports/requires
  jsFiles.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ast = esprima.parseModule(content, { jsx: true, tokens: true });
      
      // Find require statements and imports
      ast.body.forEach(node => {
        if (node.type === 'ImportDeclaration') {
          const importPath = node.source.value;
          if (!importPath.startsWith('.')) return;
          
          const resolvedPath = resolveImportPath(filePath, importPath);
          if (jsFiles.includes(resolvedPath)) {
            const imports = node.specifiers.map(specifier => {
              return specifier.type === 'ImportNamespaceSpecifier' 
                ? '*'
                : specifier.imported.name;
            });
            
            dependencies.push({
              source: filePath,
              target: resolvedPath,
              type: 'import',
              importedElements: imports
            });
          }
        } else if (node.type === 'VariableDeclaration') {
          node.declarations.forEach(decl => {
            if (decl.init && decl.init.type === 'CallExpression' && 
                decl.init.callee.name === 'require') {
              const args = decl.init.arguments;
              if (args.length > 0 && args[0].type === 'Literal') {
                const importPath = args[0].value;
                if (!importPath.startsWith('.')) return;
                
                const resolvedPath = resolveImportPath(filePath, importPath);
                if (jsFiles.includes(resolvedPath)) {
                  let imports = [];
                  if (decl.id && decl.id.type === 'ObjectPattern') {
                    imports = decl.id.properties
                      .map(prop => prop.key.name);
                  }
                  
                  dependencies.push({
                    source: filePath,
                    target: resolvedPath,
                    type: 'require',
                    importedElements: imports
                  });
                }
              }
            }
          });
        }
      });
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
    }
  });
  
  return dependencies;
}

// Helper function to resolve relative import paths
function resolveImportPath(sourcePath, importPath) {
  const sourceDir = path.dirname(sourcePath);
  let resolvedPath = path.resolve(sourceDir, importPath);
  
  // Check if the path exists directly
  if (fs.existsSync(resolvedPath)) {
    return resolvedPath;
  }
  
  // Try adding .js extension
  if (fs.existsSync(`${resolvedPath}.js`)) {
    return `${resolvedPath}.js`;
  }
  
  // Try as a directory with index.js
  if (fs.existsSync(path.join(resolvedPath, 'index.js'))) {
    return path.join(resolvedPath, 'index.js');
  }
  
  return resolvedPath; // Return the best guess even if not found
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
