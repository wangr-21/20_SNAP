class NetworkVisualization {
    constructor() {
        this.svg = null;
        this.width = 800;
        this.height = 600;
        this.graphData = null;
        this.simulation = null;
        this.showLabels = false; // 大数据集默认隐藏标签
        this.sampleSize = 200; // 默认采样大小
        
        this.init();
    }

    async init() {
        this.createSVG();
        this.setupEventListeners();
        await this.loadStats();
        await this.loadData(this.sampleSize);
    }

    async loadData(sampleSize = 200) {
        this.showLoading(true);
        
        try {
            const response = await fetch(`/api/graph-data?sample=${sampleSize}`);
            const result = await response.json();
            
            if (result.success) {
                this.graphData = result.data;
                this.updateStatsPanel(result);
                console.log(`数据加载成功: ${this.graphData.nodes.length} 个节点`);
                this.createVisualization();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('数据加载失败:', error);
            this.showError('数据加载失败: ' + error.message);
        } finally {
            this.showLoading(false);
        }
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
            document.getElementById('total-node-count').textContent = stats.totalNodes;
            document.getElementById('total-edge-count').textContent = stats.totalEdges;
            document.getElementById('density').textContent = stats.density;
            document.getElementById('avg-degree').textContent = stats.avgDegree;
        }
        
        if (stats.sampledNodes !== undefined) {
            document.getElementById('sampled-node-count').textContent = stats.sampledNodes;
        }
    }

    createSVG() {
        const container = document.getElementById('graph-container');
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        // 清空之前的SVG
        d3.select('#network-graph').selectAll('*').remove();

        this.svg = d3.select('#network-graph')
            .attr('width', this.width)
            .attr('height', this.height)
            .append('g');
    }

    createVisualization() {
    if (!this.graphData || this.graphData.nodes.length === 0) return;

    // 清除之前的可视化
    this.svg.selectAll('*').remove();

    // 根据数据规模调整力导向图参数
    const { strength, distance, collisionRadius } = this.calculateForceParameters();
    
    console.log(`力导向图参数: strength=${strength}, distance=${distance}, collisionRadius=${collisionRadius}`);

    // 创建力导向图模拟 - 使用更合理的参数
    this.simulation = d3.forceSimulation(this.graphData.nodes)
        .force('link', d3.forceLink(this.graphData.links)
            .id(d => d.id)
            .distance(distance) // 连接距离
            .strength(0.1)) // 连接强度
        .force('charge', d3.forceManyBody()
            .strength(strength) // 电荷力（节点间斥力）
            .distanceMax(200)) // 设置最大作用距离
        .force('center', d3.forceCenter(this.width / 2, this.height / 2)
            .strength(0.1)) // 中心引力强度
        .force('collision', d3.forceCollide()
            .radius(collisionRadius) // 碰撞半径
            .strength(0.8)) // 碰撞强度
        .force('x', d3.forceX(this.width / 2).strength(0.01)) // X轴引力
        .force('y', d3.forceY(this.height / 2).strength(0.01)) // Y轴引力
        .alphaDecay(0.02) // 降低alpha衰减速度，让布局更稳定
        .velocityDecay(0.4); // 增加速度衰减，防止节点过度运动

    // 创建连线
    const link = this.svg.append('g')
        .selectAll('line')
        .data(this.graphData.links)
        .join('line')
        .attr('class', 'link')
        .attr('stroke-width', d => Math.min(2, 0.5 + d.value * 0.5))
        .attr('stroke-opacity', 0.4);

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
        .style('font-size', '8px')
        .style('display', this.showLabels && this.graphData.nodes.length <= 500 ? 'block' : 'none')
        .style('pointer-events', 'none')
        .style('user-select', 'none');

    // 添加节点点击事件
    node.on('click', (event, d) => this.showNodeDetails(d));

    // 添加鼠标悬停效果
    node.on('mouseover', (event, d) => this.highlightNode(d))
       .on('mouseout', () => this.resetHighlight());

    // 保存this引用
    const that = this;

    // 更新模拟位置
    this.simulation.on('tick', () => {
        // 限制节点位置在边界内（带缓冲）
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

    // 添加缩放行为
    const zoom = d3.zoom()
        .scaleExtent([0.05, 4]) // 缩小限制到0.05，可以看更大范围
        .on('zoom', (event) => {
            this.svg.attr('transform', event.transform);
        });

    d3.select('#network-graph').call(zoom);
    
    // 初始缩放，让整个图可见
    this.zoomToFit();
}

    // 新增方法：计算力导向图参数
    calculateForceParameters() {
    const nodeCount = this.graphData.nodes.length;
    
    // 根据节点数量调整参数
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

    // 新增方法：自动缩放以适应视图
    zoomToFit() {
    const svgElement = d3.select('#network-graph');
    const bounds = this.svg.node().getBBox();
    const fullWidth = this.width;
    const fullHeight = this.height;
    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;
    
    if (width === 0 || height === 0) return; // 避免除以零
    
    const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
    const translate = [
        fullWidth / 2 - scale * midX,
        fullHeight / 2 - scale * midY
    ];
    
    svgElement.transition()
        .duration(750)
        .call(
            d3.zoom().transform,
            d3.zoomIdentity
                .translate(translate[0], translate[1])
                .scale(scale)
        );
}

    calculateForceStrength() {
        const nodeCount = this.graphData.nodes.length;
        if (nodeCount < 100) return -50;
        if (nodeCount < 500) return -100;
        if (nodeCount < 1000) return -150;
        return -200;
    }

    calculateLinkDistance() {
        const nodeCount = this.graphData.nodes.length;
        if (nodeCount < 100) return 50;
        if (nodeCount < 500) return 80;
        if (nodeCount < 1000) return 100;
        return 120;
    }

    calculateNodeRadius(node) {
    // 基于节点的度数计算半径，但限制在合理范围内
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
            // 不立即释放节点，让用户有控制感
            // d.fx = null;
            // d.fy = null;
        });
    }

    getNodeColor(group) {
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
            '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd',
            '#00d2d3', '#ff9ff3', '#f368e0', '#ff9f43'
        ];
        return colors[(group - 1) % colors.length];
    }

    async showNodeDetails(node) {
        try {
            const response = await fetch(`/api/node/${node.id}`);
            const result = await response.json();
            
            let detailsHTML = '';
            if (result.success) {
                detailsHTML = `
                    <strong>节点ID:</strong> ${node.id}<br>
                    <strong>名称:</strong> ${node.name}<br>
                    <strong>社区:</strong> ${node.group}<br>
                    <strong>度数:</strong> ${result.node.degree}<br>
                    <strong>连接数:</strong> ${result.node.totalConnections}<br>
                    <strong>聚类系数:</strong> ${result.node.clusteringCoefficient.toFixed(4)}<br>
                    <strong>示例连接:</strong> ${result.node.connections.slice(0, 10).join(', ')}${result.node.connections.length > 10 ? '...' : ''}
                `;
            } else {
                detailsHTML = `
                    <strong>节点ID:</strong> ${node.id}<br>
                    <strong>名称:</strong> ${node.name}<br>
                    <strong>社区:</strong> ${node.group}<br>
                    <strong>度数:</strong> ${node.degree || '未知'}
                `;
            }
            
            document.getElementById('node-details').innerHTML = detailsHTML;
        } catch (error) {
            console.error('获取节点详情失败:', error);
            document.getElementById('node-details').innerHTML = `
                <strong>节点ID:</strong> ${node.id}<br>
                <strong>名称:</strong> ${node.name}<br>
                <strong>社区:</strong> ${node.group}
            `;
        }
    }

    highlightNode(node) {
        // 高亮当前节点及其连接
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
                link.source.id === node.id || link.target.id === node.id ? 3 : 1
            );
    }

    resetHighlight() {
        this.svg.selectAll('.node').attr('opacity', 1);
        this.svg.selectAll('.link')
            .attr('stroke-opacity', 0.3)
            .attr('stroke-width', 1.5);
    }

    // 在 setupEventListeners 方法中添加新的事件监听
    setupEventListeners() {
    document.getElementById('reset-view').addEventListener('click', () => {
        // 释放所有固定的节点
        this.graphData.nodes.forEach(node => {
            node.fx = null;
            node.fy = null;
        });
        
        // 重新启动模拟
        this.simulation.alpha(1).restart();
        
        // 缩放以适应视图
        setTimeout(() => {
            this.zoomToFit();
        }, 500);
    });

    document.getElementById('zoom-fit').addEventListener('click', () => {
        this.zoomToFit();
    });

    document.getElementById('toggle-labels').addEventListener('click', () => {
        this.showLabels = !this.showLabels;
        this.svg.selectAll('.node-label')
            .style('display', this.showLabels && this.graphData.nodes.length <= 500 ? 'block' : 'none');
    });

    document.getElementById('freeze-layout').addEventListener('click', (event) => {
        const button = event.target;
        if (this.simulation) {
            this.simulation.stop();
            button.textContent = '继续布局';
            button.classList.add('frozen');
        } else {
            this.simulation.restart();
            button.textContent = '冻结布局';
            button.classList.remove('frozen');
        }
    });

    document.getElementById('apply-sample').addEventListener('click', () => {
        const sampleSize = parseInt(document.getElementById('sample-size').value);
        this.sampleSize = sampleSize;
        this.loadData(sampleSize);
    });

    document.getElementById('download-svg').addEventListener('click', () => {
        this.downloadSVG();
    });

    // 窗口大小改变时重新调整
    window.addEventListener('resize', () => {
        this.createSVG();
        if (this.graphData) {
            this.createVisualization();
        }
    });
}

    showLoading(show) {
        let overlay = document.getElementById('loading-overlay');
        
        if (show) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'loading-overlay';
                overlay.className = 'loading-overlay';
                overlay.innerHTML = '<div class="loading-spinner"></div>';
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
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #fed7d7;
            color: #c53030;
            padding: 20px;
            border-radius: 5px;
            text-align: center;
            z-index: 1000;
        `;
        errorDiv.innerHTML = `<strong>错误</strong><br>${message}`;
        document.getElementById('graph-container').appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
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

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new NetworkVisualization();
});