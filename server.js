const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dirTree = require('directory-tree');
const fs = require('fs');
const esprima = require('esprima');

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
    
    // Generate directory tree
    const filteredTree = dirTree(projectPath, { exclude: /node_modules|.git/ });
    
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