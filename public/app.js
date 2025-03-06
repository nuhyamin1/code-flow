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
  
  // Visualization state
  let projectData = null;
  let currentView = 'tree';
  let svg = null;
  let zoom = null;
  
  // Initialize the visualization
  function initVisualization() {
    // Clear previous visualization
    visualizationContainer.innerHTML = '';
    
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
    
    // Render the current view
    renderView();
  }
  
  // Render the selected view (tree or force graph)
  function renderView() {
    if (!projectData) return;
    
    if (currentView === 'tree') {
      renderTreeView();
    } else {
      renderForceGraph();
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
      
      // Add node
      nodes.push({
        id: nodeId,
        name: node.name,
        type: node.type,
        path: node.path,
        size: node.size || 0
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
        type: 'dependency'
      });
    });
    
    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(30));
    
    // Add links
    const link = svg.select('g').selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', d => d.type === 'dependency' ? '#ff6b6b' : '#ccc')
      .attr('stroke-dasharray', d => d.type === 'dependency' ? '5,5' : null);
    
    // Add nodes
    const node = svg.select('g').selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', d => `node ${d.type}`)
      .on('click', (event, d) => showNodeDetails(d))
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
          details += `<li>${fileName}</li>`;
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
  
  zoomInBtn.addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.3);
  });
  
  zoomOutBtn.addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 0.7);
  });
  
  resetViewBtn.addEventListener('click', resetView);
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (svg) {
      svg.attr('width', visualizationContainer.clientWidth)
         .attr('height', visualizationContainer.clientHeight);
      renderView();
    }
  });
});