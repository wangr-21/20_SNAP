class NetworkVisualization {
    constructor() {
        this.svg = null;
        this.width = 800;
        this.height = 600;
        this.graphData = null;
        this.simulation = null;
        this.zoom = null;
        this.showLabels = false;
        this.sampleSize = 200;
        this.isFrozen = false;
        this.currentDataSource = 'default';
        this.uploadedGraphData = null;
        
        this.init();
    }

    async init() {
        this.createSVG();
        this.setupUploadModal();
        this.setupEventListeners();
        await this.loadStats();
        await this.loadData(this.sampleSize);
    }

    async loadData(sampleSize = 200) {
        this.showLoading(true);
        
        try {
            let response;
            if (this.currentDataSource === 'default') {
                response = await fetch(`/api/graph-data?sample=${sampleSize}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP错误: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    this.graphData = result.data;
                    this.updateStatsPanel(result);
                    console.log(`数据加载成功: ${this.graphData.nodes.length} 个节点`);
                    this.createVisualization();
                } else {
                    throw new Error(result.message || '未知错误');
                }
            } else {
                // 使用上传的数据
                response = await this.getSampledUploadedData(sampleSize);
                
                if (response.success) {
                    this.graphData = response.data;
                    this.updateStatsPanel(response);
                    console.log(`数据加载成功: ${this.graphData.nodes.length} 个节点`);
                    this.createVisualization();
                } else {
                    throw new Error(response.message);
                }
            }
        } catch (error) {
            console.error('数据加载失败:', error);
            // 不再显示错误弹窗，而是使用默认数据
            this.showDefaultData();
        } finally {
            this.showLoading(false);
        }
    }

    showDefaultData() {
        // 创建默认的空数据
        this.graphData = {
            nodes: [
                { id: 0, name: "示例节点1", group: 1, degree: 2 },
                { id: 1, name: "示例节点2", group: 2, degree: 1 },
                { id: 2, name: "示例节点3", group: 3, degree: 1 }
            ],
            links: [
                { source: 0, target: 1, value: 1 },
                { source: 0, target: 2, value: 1 }
            ]
        };
        
        // 更新统计面板
        this.updateStatsPanel({
            totalNodes: 3,
            totalEdges: 2,
            sampledNodes: 3,
            density: "0.667",
            avgDegree: "1.33"
        });
        
        // 创建可视化
        this.createVisualization();
        
        // 更新节点信息
        document.getElementById('node-details').innerHTML = `
            <p>数据加载失败，显示示例数据</p>
            <p style="margin-top: 10px; font-size: 0.8rem; color: #95a5a6;">
                请检查网络连接或上传自定义数据集
            </p>
        `;
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const result = await response.json();
            
            if (result.success) {
                this.updateStatsPanel(result);
            }
        } catch (error) {
            console.error('统计信息加载失败:', error);
        }
    }

    updateStatsPanel(stats) {
        if (stats.totalNodes !== undefined) {
            document.getElementById('total-node-count').textContent = stats.totalNodes.toLocaleString();
            document.getElementById('total-edge-count').textContent = stats.totalEdges.toLocaleString();
            document.getElementById('density').textContent = stats.density;
            document.getElementById('avg-degree').textContent = stats.avgDegree;
        }
        
        if (stats.sampledNodes !== undefined) {
            document.getElementById('sampled-node-count').textContent = stats.sampledNodes.toLocaleString();
        }
    }

    createSVG() {
        const container = document.getElementById('graph-container');
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        d3.select('#network-graph').selectAll('*').remove();

        this.svg = d3.select('#network-graph')
            .attr('width', this.width)
            .attr('height', this.height)
            .append('g');
    }

    createVisualization() {
        if (!this.graphData || this.graphData.nodes.length === 0) return;

        this.svg.selectAll('*').remove();

        const { strength, distance, collisionRadius } = this.calculateForceParameters();
        
        console.log(`力导向图参数: strength=${strength}, distance=${distance}, collisionRadius=${collisionRadius}`);

        this.simulation = d3.forceSimulation(this.graphData.nodes)
            .force('link', d3.forceLink(this.graphData.links)
                .id(d => d.id)
                .distance(distance)
                .strength(0.1))
            .force('charge', d3.forceManyBody()
                .strength(strength)
                .distanceMax(200))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2)
                .strength(0.1))
            .force('collision', d3.forceCollide()
                .radius(collisionRadius)
                .strength(0.8))
            .force('x', d3.forceX(this.width / 2).strength(0.01))
            .force('y', d3.forceY(this.height / 2).strength(0.01))
            .alphaDecay(0.02)
            .velocityDecay(0.4);

        // 创建连线
        const link = this.svg.append('g')
            .selectAll('line')
            .data(this.graphData.links)
            .join('line')
            .attr('class', 'link')
            .attr('stroke-width', d => Math.min(1.5, 0.5 + d.value * 0.3))
            .attr('stroke-opacity', 0.5);

        // 创建节点
        const node = this.svg.append('g')
            .selectAll('circle')
            .data(this.graphData.nodes)
            .join('circle')
            .attr('class', 'node')
            .attr('r', d => this.calculateNodeRadius(d))
            .attr('fill', d => this.getNodeColor(d.group))
            .call(this.dragBehavior());

        // 创建节点标签
        const label = this.svg.append('g')
            .selectAll('text')
            .data(this.graphData.nodes)
            .join('text')
            .attr('class', 'node-label')
            .text(d => d.name)
            .attr('text-anchor', 'middle')
            .attr('dy', d => -this.calculateNodeRadius(d) - 2)
            .style('font-size', '9px')
            .style('display', this.showLabels && this.graphData.nodes.length <= 500 ? 'block' : 'none')
            .style('pointer-events', 'none')
            .style('user-select', 'none');

        // 添加节点点击事件
        node.on('click', (event, d) => this.showNodeDetails(d));

        // 添加鼠标悬停效果
        node.on('mouseover', (event, d) => this.highlightNode(d))
           .on('mouseout', () => this.resetHighlight());

        const that = this;

        // 更新模拟位置
        this.simulation.on('tick', () => {
            const padding = 20;
            node.each(function(d) {
                d.x = Math.max(padding, Math.min(that.width - padding, d.x));
                d.y = Math.max(padding, Math.min(that.height - padding, d.y));
            });

            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        // 创建缩放行为
        this.zoom = d3.zoom()
            .scaleExtent([0.05, 4])
            .on('zoom', (event) => {
                this.svg.attr('transform', event.transform);
            });

        d3.select('#network-graph').call(this.zoom);
        
        // 初始适应视图
        setTimeout(() => {
            this.zoomToFit();
        }, 1000);
    }

    calculateForceParameters() {
        const nodeCount = this.graphData.nodes.length;
        
        if (nodeCount < 50) {
            return {
                strength: -30,
                distance: 60,
                collisionRadius: 12
            };
        } else if (nodeCount < 200) {
            return {
                strength: -50,
                distance: 80,
                collisionRadius: 10
            };
        } else if (nodeCount < 500) {
            return {
                strength: -80,
                distance: 100,
                collisionRadius: 8
            };
        } else if (nodeCount < 1000) {
            return {
                strength: -120,
                distance: 120,
                collisionRadius: 6
            };
        } else {
            return {
                strength: -150,
                distance: 150,
                collisionRadius: 5
            };
        }
    }

    zoomToFit() {
        if (!this.svg || !this.graphData || this.graphData.nodes.length === 0) {
            console.log('没有数据可用于适应视图');
            return;
        }
        
        try {
            const svgElement = d3.select('#network-graph');
            const gElement = this.svg.node();
            
            if (!gElement) {
                console.log('SVG组元素不存在');
                return;
            }
            
            const nodes = this.svg.selectAll('.node').nodes();
            if (nodes.length === 0) {
                console.log('没有找到节点');
                return;
            }
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            nodes.forEach(node => {
                const cx = parseFloat(node.getAttribute('cx'));
                const cy = parseFloat(node.getAttribute('cy'));
                const r = parseFloat(node.getAttribute('r'));
                
                if (!isNaN(cx) && !isNaN(cy)) {
                    minX = Math.min(minX, cx - r);
                    minY = Math.min(minY, cy - r);
                    maxX = Math.max(maxX, cx + r);
                    maxY = Math.max(maxY, cy + r);
                }
            });
            
            if (minX === Infinity || maxX === -Infinity) {
                minX = 0;
                minY = 0;
                maxX = this.width;
                maxY = this.height;
            }
            
            const width = maxX - minX;
            const height = maxY - minY;
            const midX = (minX + maxX) / 2;
            const midY = (minY + maxY) / 2;
            
            if (width === 0 || height === 0) {
                console.log('边界框为零，无法适应视图');
                return;
            }
            
            const padding = 50;
            const scale = Math.min(
                (this.width - padding * 2) / width,
                (this.height - padding * 2) / height,
                1
            );
            
            const translate = [
                this.width / 2 - scale * midX,
                this.height / 2 - scale * midY
            ];
            
            const transform = d3.zoomIdentity
                .translate(translate[0], translate[1])
                .scale(scale);
            
            svgElement.transition()
                .duration(1000)
                .call(this.zoom.transform, transform);
            
            console.log(`适应视图: 缩放 ${scale.toFixed(2)}, 平移 [${translate[0].toFixed(0)}, ${translate[1].toFixed(0)}]`);
            
        } catch (error) {
            console.error('适应视图时出错:', error);
        }
    }

    calculateNodeRadius(node) {
        const baseRadius = 4;
        const degreeScale = Math.min(2.5, 1 + Math.log(node.degree + 1) / 3);
        return baseRadius * degreeScale;
    }

    dragBehavior() {
        const that = this;
    
        return d3.drag()
            .on('start', function(event, d) {
                if (!event.active) that.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', function(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', function(event, d) {
                if (!event.active) that.simulation.alphaTarget(0);
            });
    }

    getNodeColor(group) {
        const colors = [
            '#3498db', '#2ecc71', '#e74c3c', '#f39c12', 
            '#9b59b6', '#1abc9c', '#d35400', '#34495e',
            '#16a085', '#c0392b', '#8e44ad', '#27ae60'
        ];
        return colors[(group - 1) % colors.length];
    }

    async showNodeDetails(node) {
        try {
            let result;
            if (this.currentDataSource === 'default') {
                const response = await fetch(`/api/node/${node.id}`);
                result = await response.json();
            } else {
                // 对于上传的数据，我们直接计算节点信息
                result = this.calculateNodeInfo(node);
            }
            
            let detailsHTML = '';
            if (result.success) {
                detailsHTML = `
                    <div style="margin-bottom: 12px;"><strong>节点ID:</strong> ${node.id}</div>
                    <div style="margin-bottom: 12px;"><strong>名称:</strong> ${node.name}</div>
                    <div style="margin-bottom: 12px;"><strong>社区:</strong> ${node.group}</div>
                    <div style="margin-bottom: 12px;"><strong>度数:</strong> ${result.node.degree}</div>
                    <div style="margin-bottom: 12px;"><strong>连接数:</strong> ${result.node.totalConnections}</div>
                    <div><strong>示例连接:</strong> ${result.node.connections.slice(0, 10).join(', ')}${result.node.connections.length > 10 ? '...' : ''}</div>
                `;
            } else {
                detailsHTML = `
                    <div style="margin-bottom: 12px;"><strong>节点ID:</strong> ${node.id}</div>
                    <div style="margin-bottom: 12px;"><strong>名称:</strong> ${node.name}</div>
                    <div style="margin-bottom: 12px;"><strong>社区:</strong> ${node.group}</div>
                    <div><strong>度数:</strong> ${node.degree || '未知'}</div>
                `;
            }
            
            document.getElementById('node-details').innerHTML = detailsHTML;
        } catch (error) {
            console.error('获取节点详情失败:', error);
            document.getElementById('node-details').innerHTML = `
                <div style="margin-bottom: 12px;"><strong>节点ID:</strong> ${node.id}</div>
                <div style="margin-bottom: 12px;"><strong>名称:</strong> ${node.name}</div>
                <div><strong>社区:</strong> ${node.group}</div>
            `;
        }
    }

    calculateNodeInfo(node) {
        // 计算节点的连接信息
        const connections = this.graphData.links
            .filter(link => link.source === node.id || link.target === node.id)
            .map(link => link.source === node.id ? link.target : link.source);
        
        return {
            success: true,
            node: {
                id: node.id,
                degree: node.degree,
                connections: connections.slice(0, 20),
                totalConnections: connections.length
            }
        };
    }

    highlightNode(node) {
        this.svg.selectAll('.node')
            .attr('opacity', d => 
                d.id === node.id || 
                this.graphData.links.some(link => 
                    (link.source.id === node.id && link.target.id === d.id) ||
                    (link.target.id === node.id && link.source.id === d.id)
                ) ? 1 : 0.2
            );
            
        this.svg.selectAll('.link')
            .attr('stroke-opacity', link => 
                link.source.id === node.id || link.target.id === node.id ? 0.8 : 0.1
            )
            .attr('stroke-width', link => 
                link.source.id === node.id || link.target.id === node.id ? 2 : 1
            );
    }

    resetHighlight() {
        this.svg.selectAll('.node').attr('opacity', 1);
        this.svg.selectAll('.link')
            .attr('stroke-opacity', 0.5)
            .attr('stroke-width', 1);
    }

    setupEventListeners() {
        document.getElementById('reset-view').addEventListener('click', () => {
            this.resetView();
        });

        document.getElementById('zoom-fit').addEventListener('click', () => {
            this.zoomToFit();
        });

        document.getElementById('toggle-labels').addEventListener('click', () => {
            this.toggleLabels();
        });

        document.getElementById('freeze-layout').addEventListener('click', () => {
            this.toggleFreezeLayout();
        });

        document.getElementById('apply-sample').addEventListener('click', () => {
            const sampleSize = parseInt(document.getElementById('sample-size').value);
            this.sampleSize = sampleSize;
            this.loadData(sampleSize);
        });

        document.getElementById('download-svg').addEventListener('click', () => {
            this.downloadSVG();
        });

        // 上传文件按钮
        document.getElementById('upload-trigger').addEventListener('click', () => {
            this.showUploadModal();
        });

        window.addEventListener('resize', () => {
            this.createSVG();
            if (this.graphData) {
                this.createVisualization();
            }
        });
    }

    setupUploadModal() {
        const modal = document.getElementById('upload-modal');
        const closeBtn = document.querySelector('.close');
        const cancelBtn = document.getElementById('cancel-upload');
        const confirmBtn = document.getElementById('confirm-upload');
        const browseBtn = document.getElementById('browse-files');
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('modal-file-upload');
        
        // 打开模态框
        this.showUploadModal = () => {
            modal.style.display = 'block';
        };
        
        // 关闭模态框
        const closeModal = () => {
            modal.style.display = 'none';
            this.resetUploadModal();
        };
        
        closeBtn.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        
        // 点击模态框外部关闭
        window.onclick = (event) => {
            if (event.target === modal) {
                closeModal();
            }
        };
        
        // 浏览文件
        browseBtn.onclick = () => {
            fileInput.click();
        };
        
        uploadArea.onclick = () => {
            fileInput.click();
        };
        
        // 拖放功能
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                this.handleFileSelect();
            }
        });
        
        // 文件选择
        fileInput.addEventListener('change', () => {
            this.handleFileSelect();
        });
        
        // 确认上传
        confirmBtn.onclick = () => {
            this.processUploadedFile();
        };
    }
    
    handleFileSelect() {
        const fileInput = document.getElementById('modal-file-upload');
        const confirmBtn = document.getElementById('confirm-upload');
        const fileInfo = document.getElementById('file-info');
        
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            fileInfo.textContent = `已选择: ${file.name} (${this.formatFileSize(file.size)})`;
            confirmBtn.disabled = false;
        } else {
            fileInfo.textContent = '未选择文件';
            confirmBtn.disabled = true;
        }
    }
    
    resetUploadModal() {
        const fileInput = document.getElementById('modal-file-upload');
        const confirmBtn = document.getElementById('confirm-upload');
        const fileInfo = document.getElementById('file-info');
        const progress = document.getElementById('upload-progress');
        
        fileInput.value = '';
        fileInfo.textContent = '未选择文件';
        confirmBtn.disabled = true;
        progress.style.display = 'none';
    }
    
    async processUploadedFile() {
        const fileInput = document.getElementById('modal-file-upload');
        const progress = document.getElementById('upload-progress');
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        const modal = document.getElementById('upload-modal');
        
        if (!fileInput.files.length) return;
        
        const file = fileInput.files[0];
        progress.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = '读取文件中...';
        
        try {
            progressFill.style.width = '30%';
            progressText.textContent = '解析数据...';
            
            const fileContent = await this.readFile(file);
            
            progressFill.style.width = '60%';
            progressText.textContent = '处理数据...';
            
            const graphData = await this.parseFileData(fileContent, file.name);
            
            // 添加调试信息
            console.log('解析后的数据:', graphData);
            console.log('节点数量:', graphData.nodes.length);
            console.log('边数量:', graphData.links.length);
            
            if (graphData.nodes.length === 0) {
                throw new Error('解析后没有发现节点数据');
            }
            
            progressFill.style.width = '90%';
            progressText.textContent = '生成可视化...';
            
            // 保存上传的数据
            this.uploadedGraphData = graphData;
            this.currentDataSource = 'uploaded';
            
            // 更新文件信息
            document.getElementById('file-info').textContent = `已加载: ${file.name} (${graphData.nodes.length} 节点, ${graphData.links.length} 边)`;
            
            // 加载数据
            await this.loadData(this.sampleSize);
            
            progressFill.style.width = '100%';
            progressText.textContent = '完成!';
            
            setTimeout(() => {
                modal.style.display = 'none';
                this.resetUploadModal();
                this.showSuccess(`数据上传成功！加载了 ${graphData.nodes.length} 个节点和 ${graphData.links.length} 条边`);
            }, 500);
            
        } catch (error) {
            console.error('文件处理失败:', error);
            this.showError('文件处理失败: ' + error.message);
            progressText.textContent = '处理失败';
            
            // 显示详细的错误信息
            document.getElementById('file-info').textContent = `错误: ${error.message}`;
        }
    }
    
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }
    
    parseFileData(content, filename) {
        return new Promise((resolve, reject) => {
            try {
                let graphData;
                
                if (filename.endsWith('.json')) {
                    // JSON格式
                    const parsed = JSON.parse(content);
                    
                    // 支持多种JSON格式
                    if (parsed.nodes && parsed.links) {
                        graphData = parsed;
                    } else if (parsed.vertices && parsed.edges) {
                        // 另一种常见的图数据格式
                        graphData = {
                            nodes: parsed.vertices.map(v => ({
                                id: v.id || v._id || v.name,
                                name: v.name || v.label || `节点${v.id}`,
                                group: v.group || v.community || 1,
                                degree: v.degree || 0
                            })),
                            links: parsed.edges.map(e => ({
                                source: e.source || e.from,
                                target: e.target || e.to,
                                value: e.value || e.weight || 1
                            }))
                        };
                    } else {
                        throw new Error('不支持的JSON格式');
                    }
                } else if (filename.endsWith('.csv')) {
                    // CSV格式
                    graphData = this.parseCSV(content);
                } else {
                    // SNAP格式 (txt) 或其他文本格式
                    graphData = this.parseSNAP(content);
                }
                
                // 验证数据格式
                if (!graphData.nodes || !Array.isArray(graphData.nodes)) {
                    throw new Error('数据格式不正确，必须包含nodes数组');
                }
                
                if (!graphData.links || !Array.isArray(graphData.links)) {
                    graphData.links = []; // 如果没有边，创建空数组
                }
                
                // 确保每个节点都有必需的属性
                graphData.nodes = graphData.nodes.map((node, index) => ({
                    id: node.id !== undefined ? node.id : index,
                    name: node.name || node.label || `节点${node.id !== undefined ? node.id : index}`,
                    group: node.group || node.community || (node.id % 8) + 1,
                    degree: node.degree || 0
                }));
                
                // 计算节点度数
                this.calculateNodeDegrees(graphData);
                
                console.log('最终处理的数据:', graphData);
                resolve(graphData);
            } catch (error) {
                reject(error);
            }
        });
    }
    
    parseSNAP(content) {
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        const nodesMap = new Map();
        const links = [];
        
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                const source = parseInt(parts[0]);
                const target = parseInt(parts[1]);
                
                if (!isNaN(source) && !isNaN(target)) {
                    // 添加节点
                    if (!nodesMap.has(source)) {
                        nodesMap.set(source, {
                            id: source,
                            name: `节点${source}`,
                            group: (source % 8) + 1,
                            degree: 0
                        });
                    }
                    
                    if (!nodesMap.has(target)) {
                        nodesMap.set(target, {
                            id: target,
                            name: `节点${target}`,
                            group: (target % 8) + 1,
                            degree: 0
                        });
                    }
                    
                    // 添加边
                    links.push({
                        source: source,
                        target: target,
                        value: 1
                    });
                }
            }
        });
        
        const nodes = Array.from(nodesMap.values());
        
        return { nodes, links };
    }
    
    parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
            throw new Error('CSV文件为空');
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        const sourceIndex = headers.findIndex(h => h.toLowerCase() === 'source');
        const targetIndex = headers.findIndex(h => h.toLowerCase() === 'target');
        
        if (sourceIndex === -1 || targetIndex === -1) {
            throw new Error('CSV文件必须包含source和target列');
        }
        
        const nodesMap = new Map();
        const links = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length <= Math.max(sourceIndex, targetIndex)) continue;
            
            const source = parseInt(values[sourceIndex]);
            const target = parseInt(values[targetIndex]);
            
            if (!isNaN(source) && !isNaN(target)) {
                // 添加节点
                if (!nodesMap.has(source)) {
                    nodesMap.set(source, {
                        id: source,
                        name: `节点${source}`,
                        group: (source % 8) + 1,
                        degree: 0
                    });
                }
                
                if (!nodesMap.has(target)) {
                    nodesMap.set(target, {
                        id: target,
                        name: `节点${target}`,
                        group: (target % 8) + 1,
                        degree: 0
                    });
                }
                
                // 添加边
                links.push({
                    source: source,
                    target: target,
                    value: 1
                });
            }
        }
        
        const nodes = Array.from(nodesMap.values());
        
        return { nodes, links };
    }
    
    calculateNodeDegrees(graphData) {
        /*// 重置所有节点的度数
        graphData.nodes.forEach(node => {
            node.degree = 0;
        });
        
        // 计算每个节点的度数
        graphData.links.forEach(link => {
            const sourceNode = graphData.nodes.find(n => n.id === link.source);
            const targetNode = graphData.nodes.find(n => n.id === link.target);
            
            if (sourceNode) sourceNode.degree++;
            if (targetNode) targetNode.degree++;
        });*/
        //优化：优化节点度数计算
        // 使用 Map 优化：O(N + E)
        const nodeById = new Map();
        graphData.nodes.forEach(node => {
            node.degree = 0;
            nodeById.set(node.id, node);
        });

        graphData.links.forEach(link => {
            // link.source / link.target 可能是 id 或者已经被 forceLink 替换为对象
            const sId = (typeof link.source === 'object') ? link.source.id : link.source;
            const tId = (typeof link.target === 'object') ? link.target.id : link.target;

            const sNode = nodeById.get(sId);
            const tNode = nodeById.get(tId);
            if (sNode) sNode.degree++;
            if (tNode) tNode.degree++;
        });
    }
    
    getSampledUploadedData(sampleSize) {
        return new Promise((resolve) => {
            if (!this.uploadedGraphData) {
                resolve({ success: false, message: '没有上传的数据' });
                return;
            }
            
            console.log('原始数据:', this.uploadedGraphData.nodes.length, '节点', this.uploadedGraphData.links.length, '边');
            
            // 如果采样大小为0或者大于等于总节点数，返回所有数据
            if (sampleSize === 0 || sampleSize >= this.uploadedGraphData.nodes.length) {
                console.log('返回所有数据，不进行采样');
                resolve({
                    success: true,
                    data: this.uploadedGraphData,
                    totalNodes: this.uploadedGraphData.nodes.length,
                    totalEdges: this.uploadedGraphData.links.length,
                    sampledNodes: this.uploadedGraphData.nodes.length,
                    sampledEdges: this.uploadedGraphData.links.length
                });
                return;
            }
            
            // 采样逻辑
            const sampledNodes = [];
            const sampledNodeIds = new Set();
            
            // 选择度数最高的节点
            const sortedNodes = [...this.uploadedGraphData.nodes].sort((a, b) => b.degree - a.degree);
            const selectedNodes = sortedNodes.slice(0, sampleSize);
            
            selectedNodes.forEach(node => {
                sampledNodes.push(node);
                sampledNodeIds.add(node.id);
            });
            
            // 选择连接这些节点的边
            const sampledLinks = this.uploadedGraphData.links.filter(link => 
                sampledNodeIds.has(link.source) && sampledNodeIds.has(link.target)
            );
            
            console.log(`数据采样: ${sampledNodes.length} 个节点, ${sampledLinks.length} 条边`);
            
            if (sampledNodes.length === 0) {
                resolve({ success: false, message: '采样后没有节点' });
                return;
            }
            
            resolve({
                success: true,
                data: { nodes: sampledNodes, links: sampledLinks },
                totalNodes: this.uploadedGraphData.nodes.length,
                totalEdges: this.uploadedGraphData.links.length,
                sampledNodes: sampledNodes.length,
                sampledEdges: sampledLinks.length
            });
        });
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    resetView() {
        if (this.graphData && this.graphData.nodes) {
            this.graphData.nodes.forEach(node => {
                node.fx = null;
                node.fy = null;
            });
        }
        
        if (this.zoom) {
            d3.select('#network-graph').transition()
                .duration(750)
                .call(this.zoom.transform, d3.zoomIdentity);
        }
        
        if (this.simulation) {
            this.simulation.alpha(1).restart();
        }
        
        console.log('视图已重置');
    }

    toggleLabels() {
        this.showLabels = !this.showLabels;
        const displayValue = this.showLabels && this.graphData.nodes.length <= 500 ? 'block' : 'none';
        this.svg.selectAll('.node-label').style('display', displayValue);
        
        const button = document.getElementById('toggle-labels');
        const textEl=button.querySelector('.label');
        if(textEl){
            textEl.textContent=this.showLabels ? '隐藏标签' : '标签';
        }else{
            button.textContent = this.showLabels ? '隐藏标签' : '标签';
        }
        
        console.log(`标签显示: ${this.showLabels ? '开启' : '关闭'}`);
    }

    toggleFreezeLayout() {
        if (!this.simulation) {
            console.log('模拟未初始化');
            return;
        }
        
        const button = document.getElementById('freeze-layout');
        const textEl=button.querySelector('.freeze');
        
        if (this.isFrozen) {
            this.simulation.alpha(0.3).restart();
            if(textEl) {
                textEl.textContent='冻结';
            }
            else{
                button.textContent = '冻结';
            }
            button.classList.remove('frozen');
            this.isFrozen = false;
            console.log('布局模拟已恢复');
        } else {
            this.simulation.alphaTarget(0);
            this.simulation.alpha(0);
            if(textEl) {
                textEl.textContent='继续';
            }
            else{
                button.textContent = '继续';
            }
            button.classList.add('frozen');
            this.isFrozen = true;
            console.log('布局已冻结');
        }
    }

    showLoading(show) {
        let overlay = document.getElementById('loading-overlay');
        
        if (show) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'loading-overlay';
                overlay.className = 'loading-overlay';
                overlay.innerHTML = `
                    <div class="loading-spinner"></div>
                    <div class="loading-text">加载数据中...</div>
                `;
                document.getElementById('graph-container').appendChild(overlay);
            }
            overlay.style.display = 'flex';
        } else if (overlay) {
            overlay.style.display = 'none';
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideInRight 0.3s;
            max-width: 300px;
        `;
        errorDiv.innerHTML = `<strong>错误</strong><br>${message}`;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
    
    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideInRight 0.3s;
            max-width: 300px;
        `;
        successDiv.innerHTML = `<strong>成功</strong><br>${message}`;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }

    downloadSVG() {
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(document.getElementById('network-graph'));
        const blob = new Blob([source], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `network-graph-${this.graphData.nodes.length}-nodes.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new NetworkVisualization();
});