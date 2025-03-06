document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const projectForm = document.getElementById('project-form');
  const projectPathInput = document.getElementById('project-path');
  const visualizationContainer = document.getElementById('visualization');
  const detailsContent = document.getElementById('details-content');
  const viewTypeSelect = document.getElementById('view-type');
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const resetViewBtn = document.getElementById('reset-view');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  
  // Fullscreen modal elements
  const fullscreenModal = document.getElementById('fullscreen-modal');
  const closeFullscreenBtn = document.getElementById('close-fullscreen');
  const fullscreenVisualization = document.getElementById('fullscreen-visualization');
  const fullscreenViewTypeSelect = document.getElementById('fullscreen-view-type');
  const fullscreenZoomInBtn = document.getElementById('fullscreen-zoom-in');
  const fullscreenZoomOutBtn = document.getElementById('fullscreen-zoom-out');
  const fullscreenResetViewBtn = document.getElementById('fullscreen-reset-view');
  
  // Visualization state
  let projectData = null;
  let currentView = 'tree';
  let svg = null;
  let zoom = null;
  let fullscreenSvg = null;
  let fullscreenZoom = null;
  let isFullscreen = false;
  
  // Initialize the visualization
  function initVisualization() {
    // Clear previous visualization
    visualizationContainer.innerHTML = '';
    fullscreenVisualization.innerHTML = '';
    
    // Create SVG element
    const width = visualizationContainer.clientWidth;
    const height = visualizationContainer.clientHeight;
    
    svg = d3.select('#visualization')
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    
    // Add zoom behavior
    zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        svg.select('g').attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Add a group for all visualization elements
    svg.append('g');
    
    // Initialize fullscreen visualization if in fullscreen mode
    if (isFullscreen) {
      initFullscreenVisualization();
    }
    
    // Render the current view
    renderView();
  }
  
  // Initialize the fullscreen visualization
  function initFullscreenVisualization() {
    const width = fullscreenVisualization.clientWidth;
    const height = fullscreenVisualization.clientHeight;
    
    fullscreenSvg = d3.select('#fullscreen-visualization')
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    
    // Add zoom behavior
    fullscreenZoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        fullscreenSvg.select('g').attr('transform', event.transform);
      });
    
    fullscreenSvg.call(fullscreenZoom);
    
    // Add a group for all visualization elements
    fullscreenSvg.append('g');
  }
  // Toggle fullscreen mode
  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    
    if (isFullscreen) {
      // Show fullscreen modal
      fullscreenModal.classList.add('active');
      
      // Sync view type
      fullscreenViewTypeSelect.value = currentView;
      
      // Initialize fullscreen visualization
      initFullscreenVisualization();
      
      // Render the current view in fullscreen
      renderView();
    } else {
      // Hide fullscreen modal
      fullscreenModal.classList.remove('active');
    }
  }
  
  // Render the selected view (tree or force graph)
  function renderView() {
    if (!projectData) return;
    
    if (currentView === 'tree') {
      renderTreeView();
      if (isFullscreen) renderFullscreenTreeView();
    } else {
      renderForceGraph();
      if (isFullscreen) renderFullscreenForceGraph();
    }
  }
  
  // Render tree view visualization
  function renderTreeView() {
    const width = visualizationContainer.clientWidth;
    const height = visualizationContainer.clientHeight;
    
    // Clear previous content
    svg.select('g').selectAll('*').remove();
    
    // Create tree layout
    const treeLayout = d3.tree()
      .size([height - 100, width - 200]);
    
    // Convert project data to hierarchy
    const root = d3.hierarchy(projectData.structure);
    
    // Calculate tree node positions
    const treeData = treeLayout(root);
    
    // Add links between nodes
    svg.select('g').selectAll('.link')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d => {
        return `M${d.source.y},${d.source.x}
                C${(d.source.y + d.target.y) / 2},${d.source.x}
                 ${(d.source.y + d.target.y) / 2},${d.target.x}
                 ${d.target.y},${d.target.x}`;
      });
    
    // Add nodes
    const nodes = svg.select('g').selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', d => {
        return `node ${d.data.type === 'directory' ? 'directory' : 'file'}`;
      })
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .on('click', (event, d) => showNodeDetails(d.data));
    
    // Add circles to nodes
    nodes.append('circle')
      .attr('r', 8);
    
    // Add labels to nodes
    nodes.append('text')
      .attr('dy', '.31em')
      .attr('x', d => d.children ? -12 : 12)
      .style('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.data.name);
    
    // Center the view
    resetView();
  }
  
  // Render force-directed graph visualization
  function renderForceGraph() {
    const width = visualizationContainer.clientWidth;
    const height = visualizationContainer.clientHeight;
    
    // Clear previous content
    svg.select('g').selectAll('*').remove();
    
    // Prepare nodes and links data
    const nodes = [];
    const links = [];
    
    // Function to recursively process nodes
    function processNode(node, parent = null) {
      const nodeId = node.path;
      
      // Add node with additional properties for JS files
      nodes.push({
        id: nodeId,
        name: node.name,
        type: node.type,
        path: node.path,
        size: node.size || 0,
        extension: node.extension
      });
      
      // Add link to parent if exists
      if (parent) {
        links.push({
          source: parent.path,
          target: nodeId,
          type: 'structure'
        });
      }
      
      // Process children recursively
      if (node.children) {
        node.children.forEach(child => processNode(child, node));
      }
    }
    
    // Process the root node
    processNode(projectData.structure);
    
    // Add dependency links
    if (projectData.dependencies) {
      projectData.dependencies.forEach(dep => {
        links.push({
          source: dep.source,
          target: dep.target,
          type: 'dependency',
          dependencyType: dep.type,
          importedElements: dep.importedElements
        });
      });
    }
    
    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(30));
    
    // Create tooltip div
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
    
    // Add links
    const link = svg.select('g').selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', d => {
        let classes = 'link';
        if (d.type === 'dependency') {
          classes += ' dependency ' + d.dependencyType;
        }
        return classes;
      })
      .attr('stroke-width', d => d.type === 'dependency' ? 2 : 1)
      .attr('stroke', d => {
        if (d.type === 'dependency') {
          return d.dependencyType === 'import' ? '#4a90e2' : '#ff6b6b';
        }
        return '#ccc';
      })
      .attr('stroke-dasharray', d => d.type === 'dependency' && d.dependencyType === 'require' ? '5,5' : null)
      .on('mouseover', function(event, d) {
        if (d.type === 'dependency') {
          d3.select(this).attr('stroke-width', 3);
          
          tooltip.transition()
            .duration(200)
            .style('opacity', .9);
          
          const sourceFile = d.source.id ? d.source.id.split('/').pop() : d.source.split('/').pop();
          const targetFile = d.target.id ? d.target.id.split('/').pop() : d.target.split('/').pop();
          const imports = d.importedElements && d.importedElements.length > 0 ? d.importedElements.join(', ') : 'All exports';
          
          tooltip.html(`<strong>${sourceFile}</strong> ${d.dependencyType}s from <strong>${targetFile}</strong><br><em>Imported:</em> ${imports}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        }
      })
      .on('mouseout', function(event, d) {
        if (d.type === 'dependency') {
          d3.select(this).attr('stroke-width', 2);
          tooltip.transition()
            .duration(500)
            .style('opacity', 0);
        }
      });
    
    // Add nodes
    const node = svg.select('g').selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', d => {
        let classes = `node ${d.type}`;
        if (d.extension === '.js') classes += ' js-file';
        return classes;
      })
      .on('click', (event, d) => showNodeDetails(d))
      .on('mouseover', function(event, d) {
        // Highlight connected links and nodes
        link.each(function(l) {
          if (l.source.id === d.id || l.target.id === d.id || 
              l.source === d.id || l.target === d.id) {
            d3.select(this).attr('stroke-width', 3);
          }
        });
      })
      .on('mouseout', function() {
        // Reset link styling
        link.attr('stroke-width', d => d.type === 'dependency' ? 2 : 1.5);
      })
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // Add circles to nodes
    node.append('circle')
      .attr('r', d => d.type === 'directory' ? 10 : 6);
    
    // Add labels to nodes
    node.append('text')
      .attr('dy', -12)
      .attr('text-anchor', 'middle')
      .text(d => d.name);
    
    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }
  
  // Render tree view visualization for fullscreen mode
  function renderFullscreenTreeView() {
    const width = fullscreenVisualization.clientWidth;
    const height = fullscreenVisualization.clientHeight;
    
    // Clear previous content
    fullscreenSvg.select('g').selectAll('*').remove();
    
    // Create tree layout
    const treeLayout = d3.tree()
      .size([height - 100, width - 200]);
    
    // Convert project data to hierarchy
    const root = d3.hierarchy(projectData.structure);
    
    // Calculate tree node positions
    const treeData = treeLayout(root);
    
    // Add links between nodes
    fullscreenSvg.select('g').selectAll('.link')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d => {
        return `M${d.source.y},${d.source.x}
                C${(d.source.y + d.target.y) / 2},${d.source.x}
                 ${(d.source.y + d.target.y) / 2},${d.target.x}
                 ${d.target.y},${d.target.x}`;
      });
    
    // Add nodes
    const nodes = fullscreenSvg.select('g').selectAll('.node')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('class', d => {
        return `node ${d.data.type === 'directory' ? 'directory' : 'file'}`;
      })
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .on('click', (event, d) => showNodeDetails(d.data));
    
    // Add circles to nodes
    nodes.append('circle')
      .attr('r', 8);
    
    // Add labels to nodes
    nodes.append('text')
      .attr('dy', '.31em')
      .attr('x', d => d.children ? -12 : 12)
      .style('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.data.name);
    
    // Center the view
    resetFullscreenView();
  }
  
  // Render force-directed graph visualization for fullscreen mode
  function renderFullscreenForceGraph() {
    const width = fullscreenVisualization.clientWidth;
    const height = fullscreenVisualization.clientHeight;
    
    // Clear previous content
    fullscreenSvg.select('g').selectAll('*').remove();
    
    // Prepare nodes and links data
    const nodes = [];
    const links = [];
    
    // Function to recursively process nodes
    function processNode(node, parent = null) {
      const nodeId = node.path;
      
      // Add node with additional properties for JS files
      nodes.push({
        id: nodeId,
        name: node.name,
        type: node.type,
        path: node.path,
        size: node.size || 0,
        extension: node.extension
      });
      
      // Add link to parent if exists
      if (parent) {
        links.push({
          source: parent.path,
          target: nodeId,
          type: 'structure'
        });
      }
      
      // Process children recursively
      if (node.children) {
        node.children.forEach(child => processNode(child, node));
      }
    }
    
    // Process the root node
    processNode(projectData.structure);
    
    // Add dependency links
    projectData.dependencies.forEach(dep => {
      links.push({
        source: dep.source,
        target: dep.target,
        type: 'dependency',
        dependencyType: dep.type // 'import' or 'require'
      });
    });
    
    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(30));
    
    // Create tooltip div
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
    
    // Add links
    const link = fullscreenSvg.select('g').selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', d => {
        let classes = 'link';
        if (d.type === 'dependency') {
          classes += ' dependency ' + d.dependencyType;
        }
        return classes;
      })
      .attr('stroke', d => d.type === 'dependency' ? (d.dependencyType === 'import' ? '#4a90e2' : '#ff6b6b') : '#ccc')
      .attr('stroke-dasharray', d => d.type === 'dependency' ? (d.dependencyType === 'import' ? null : '5,5') : null)
      .on('mouseover', function(event, d) {
        if (d.type === 'dependency') {
          d3.select(this).attr('stroke-width', 3);
          
          // Show tooltip with dependency info
          tooltip.transition()
            .duration(200)
            .style('opacity', .9);
          
          const sourceFile = d.source.id?.split('/').pop() || d.source.split('/').pop();
          const targetFile = d.target.id?.split('/').pop() || d.target.split('/').pop();
          const imports = d.importedElements?.join(', ') || 'All exports';
          
          tooltip.html(`<strong>${sourceFile}</strong> ${d.dependencyType}s from <strong>${targetFile}</strong><br><em>Imported:</em> ${imports}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        }
      })
      .on('mouseout', function(event, d) {
        if (d.type === 'dependency') {
          d3.select(this).attr('stroke-width', 2);
          tooltip.transition()
            .duration(500)
            .style('opacity', 0);
        }
      });
    
    // Add nodes
    const node = fullscreenSvg.select('g').selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', d => {
        let classes = `node ${d.type}`;
        if (d.extension === '.js') classes += ' js-file';
        return classes;
      })
      .on('click', (event, d) => showNodeDetails(d))
      .on('mouseover', function(event, d) {
        // Highlight connected links and nodes
        link.each(function(l) {
          if (l.source.id === d.id || l.target.id === d.id || 
              l.source === d.id || l.target === d.id) {
            d3.select(this).attr('stroke-width', 3);
          }
        });
      })
      .on('mouseout', function() {
        // Reset link styling
        link.attr('stroke-width', d => d.type === 'dependency' ? 2 : 1.5);
      })
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // Add circles to nodes
    node.append('circle')
      .attr('r', d => d.type === 'directory' ? 10 : 6);
    
    // Add labels to nodes
    node.append('text')
      .attr('dy', -12)
      .attr('text-anchor', 'middle')
      .text(d => d.name);
    
    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }
  
  // Reset the fullscreen view to fit all content
  function resetFullscreenView() {
    const g = fullscreenSvg.select('g');
    const bounds = g.node().getBBox();
    const width = fullscreenVisualization.clientWidth;
    const height = fullscreenVisualization.clientHeight;
    const dx = bounds.width;
    const dy = bounds.height;
    const x = bounds.x + dx / 2;
    const y = bounds.y + dy / 2;
    const scale = 0.9 / Math.max(dx / width, dy / height);
    const translate = [width / 2 - scale * x, height / 2 - scale * y];
    
    fullscreenSvg.transition()
      .duration(750)
      .call(fullscreenZoom.transform, d3.zoomIdentity
        .translate(translate[0], translate[1])
        .scale(scale));
  }
  
  // Show details for the selected node
  function showNodeDetails(node) {
    // Highlight the selected node
    svg.selectAll('.node').classed('selected', false);
    svg.selectAll('.node').filter(d => d.path === node.path || d.id === node.path)
      .classed('selected', true);
    
    // Display node details
    let details = `<h4>${node.name}</h4>`;
    details += `<p><strong>Type:</strong> ${node.type}</p>`;
    details += `<p><strong>Path:</strong> ${node.path}</p>`;
    
    if (node.size) {
      details += `<p><strong>Size:</strong> ${formatFileSize(node.size)}</p>`;
    }
    
    if (node.extension) {
      details += `<p><strong>Extension:</strong> ${node.extension}</p>`;
    }
    
    // Show dependencies if it's a JS file
    if (node.extension === '.js') {
      const incomingDeps = projectData.dependencies.filter(dep => dep.target === node.path);
      const outgoingDeps = projectData.dependencies.filter(dep => dep.source === node.path);
      
      if (incomingDeps.length > 0) {
        details += `<p><strong>Imported by:</strong></p><ul>`;
        incomingDeps.forEach(dep => {
          const fileName = dep.source.split('/').pop();
          details += `<li>${fileName}</li>`;
        });
        details += `</ul>`;
      }
      
      if (outgoingDeps.length > 0) {
        details += `<p><strong>Imports:</strong></p><ul>`;
        outgoingDeps.forEach(dep => {
          const fileName = dep.target.split('/').pop();
          const imports = dep.importedElements?.join(', ') || 'All exports';
          details += `<li>${fileName} (${imports})</li>`;
        });
        details += `</ul>`;
      }
    }
    
    detailsContent.innerHTML = details;
  }
  
  // Format file size in a human-readable format
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // Reset the view to fit all content
  function resetView() {
    const g = svg.select('g');
    const bounds = g.node().getBBox();
    const width = visualizationContainer.clientWidth;
    const height = visualizationContainer.clientHeight;
    const dx = bounds.width;
    const dy = bounds.height;
    const x = bounds.x + dx / 2;
    const y = bounds.y + dy / 2;
    const scale = 0.9 / Math.max(dx / width, dy / height);
    const translate = [width / 2 - scale * x, height / 2 - scale * y];
    
    svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity
        .translate(translate[0], translate[1])
        .scale(scale));
  }
  
  // Event listeners
  projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const projectPath = projectPathInput.value.trim();
    
    if (!projectPath) return;
    
    try {
      // Show loading state
      visualizationContainer.innerHTML = '<div class="loading">Analyzing project structure...</div>';
      
      // Fetch project structure from API
      const response = await fetch('/api/project-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ projectPath })
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze project');
      }
      
      projectData = await response.json();
      
      // Initialize visualization
      initVisualization();
    } catch (error) {
      console.error('Error:', error);
      visualizationContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
  });
  
  viewTypeSelect.addEventListener('change', () => {
    currentView = viewTypeSelect.value;
    renderView();
  });
  
  fullscreenViewTypeSelect.addEventListener('change', () => {
    currentView = fullscreenViewTypeSelect.value;
    renderView();
  });
  
  zoomInBtn.addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.3);
  });
  
  zoomOutBtn.addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 0.7);
  });
  
  fullscreenZoomInBtn.addEventListener('click', () => {
    fullscreenSvg.transition().duration(300).call(fullscreenZoom.scaleBy, 1.3);
  });
  
  fullscreenZoomOutBtn.addEventListener('click', () => {
    fullscreenSvg.transition().duration(300).call(fullscreenZoom.scaleBy, 0.7);
  });
  
  resetViewBtn.addEventListener('click', resetView);
  fullscreenResetViewBtn.addEventListener('click', resetFullscreenView);
  
  // Fullscreen toggle
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  closeFullscreenBtn.addEventListener('click', toggleFullscreen);
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (svg) {
      svg.attr('width', visualizationContainer.clientWidth)
         .attr('height', visualizationContainer.clientHeight);
      renderView();
    }
    
    if (isFullscreen && fullscreenSvg) {
      fullscreenSvg.attr('width', fullscreenVisualization.clientWidth)
                   .attr('height', fullscreenVisualization.clientHeight);
      renderView();
    }
  });
});