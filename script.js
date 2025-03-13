// 設定ファイルからデータファイルのリストを取得する関数
async function getDataFilesList() {
    try {
        const response = await fetch('config.json');
        const config = await response.json();
        return config.dataFiles || [];
    } catch (error) {
        console.error('設定ファイルの読み込みに失敗しました:', error);
        return [];
    }
}

// サンキーチャートを描画する関数
function drawSankeyChart(data, containerId, title) {
    // コンテナの作成
    const container = d3.select(`#${containerId}`);
    
    // タイトルの追加
    container.append("h2")
        .text(title);
    
    // チャート用のdiv要素を追加
    const chartDiv = container.append("div")
        .attr("class", "chart-container");
    
    // SVGのサイズとマージンを設定
    const margin = {top: 50, right: 10, bottom: 10, left: 10};
    const width = 900 - margin.left - margin.right;
    const height = 1000 - margin.top - margin.bottom;

    // SVG要素を作成
    const svg = chartDiv.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // サンキーレイアウトを設定
    const sankey = d3.sankey()
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[1, 1], [width - 1, height - 5]])
        .nodeSort((a, b) => {
            // 同じグループのノードを近くに配置
            if (a.group && b.group && a.group === b.group) {
                return 0;
            }
            return null; // デフォルトのソート
        });

    // データをサンキーレイアウト用に変換
    const graph = sankey(data);
    
    // ノードの段階を特定（x座標でグループ化）
    const stagePositions = [];
    const nodesByX = {};
    
    // ノードをx座標でグループ化
    graph.nodes.forEach(node => {
        const x = Math.floor(node.x0);
        if (!nodesByX[x]) {
            nodesByX[x] = [];
            stagePositions.push(x);
        }
        nodesByX[x].push(node);
    });
    
    // x座標でソート
    stagePositions.sort((a, b) => a - b);
    
    // 段階のラベル
    const stageLabels = ["流入キーワード", "情報収集", "評価検討", "意思決定", "mCV", "CV"];
    
    // 段階ラベルを追加
    for (let i = 0; i < stagePositions.length && i < stageLabels.length; i++) {
        const x = stagePositions[i];
        const nodes = nodesByX[x];
        if (nodes && nodes.length > 0) {
            // 段階の中央位置を計算
            const avgX = (nodes[0].x0 + nodes[0].x1) / 2;
            
            // 段階ラベルを追加
            svg.append("text")
                .attr("class", "stage-label")
                .attr("x", avgX)
                .attr("y", -25) // 上部に配置
                .attr("text-anchor", "middle")
                .attr("font-size", "14px")
                .attr("font-weight", "bold")
                .text(stageLabels[i]);
                
            // 段階の区切り線を追加（オプション）
            svg.append("line")
                .attr("class", "stage-separator")
                .attr("x1", nodes[0].x0 - 5)
                .attr("y1", -10)
                .attr("x2", nodes[0].x0 - 5)
                .attr("y2", height)
                .attr("stroke", "#ddd")
                .attr("stroke-dasharray", "3,3");
        }
    }

    // カラースケールを設定
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // リンク（フロー）を描画
    const link = svg.append("g")
        .attr("class", "links")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.2)
        .selectAll("path")
        .data(graph.links)
        .enter().append("path")
        .attr("class", "link")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => color(d.source.name))
        .attr("stroke-width", 10) // すべての経路を均一の太さに設定 
        .on("mouseover", function(event, d) {
            // リンクをハイライト
            d3.select(this)
                .attr("stroke-opacity", 0.5)
                .attr("stroke-width", 7); // ハイライト時は少し太く
            
            // 関連するノードをハイライト
            node.filter(n => n === d.source || n === d.target)
                .select("rect")
                .attr("stroke-width", 3);
            
            // ツールチップを表示
            const tooltip = d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("position", "absolute")
                .style("background", "rgba(255, 255, 255, 0.9)")
                .style("padding", "10px")
                .style("border", "1px solid #ddd")
                .style("border-radius", "5px")
                .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
                .style("pointer-events", "none")
                .style("opacity", 0);
                
            // ツールチップの内容を作成
            let tooltipContent = `
                <div><strong>元ノード:</strong> ${d.source.name}</div>
                <div><strong>先ノード:</strong> ${d.target.name}</div>
                <div><strong>流量:</strong> ${d.value}</div>
            `;
            
            // JSONに追加情報がある場合は表示
            if (d.tooltip) {
                tooltipContent += `<div class="tooltip-custom">${d.tooltip}</div>`;
            }
            
            // ソースノードに追加情報がある場合
            if (d.source.tooltip) {
                tooltipContent += `<div class="tooltip-source"><strong>元ノード情報:</strong> ${d.source.tooltip}</div>`;
            }
            
            // ターゲットノードに追加情報がある場合
            if (d.target.tooltip) {
                tooltipContent += `<div class="tooltip-target"><strong>先ノード情報:</strong> ${d.target.tooltip}</div>`;
            }
            
            tooltip.html(tooltipContent)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px")
                .style("opacity", 1);
        })
        .on("mousemove", function(event) {
            // ツールチップの位置を更新
            d3.select(".tooltip")
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            // ハイライトを元に戻す
            d3.select(this)
                .attr("stroke-opacity", 0.2)
                .attr("stroke-width", 5); // 元の均一の太さに戻す
            
            // ノードのハイライトを元に戻す
            node.select("rect")
                .attr("stroke-width", 1);
            
            // ツールチップを削除
            d3.select(".tooltip").remove();
        });

    // リンク上に値を表示するテキストを追加
    svg.append("g")
        .attr("class", "link-labels")
        .selectAll("text")
        .data(graph.links)
        .enter().append("text")
        .attr("class", "link-value")
        .attr("x", d => (d.source.x1 + d.target.x0) / 2)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", "#000")
        .attr("pointer-events", "none")
        .text(d => d.value)
        .attr("background", "white")
        .each(function(d) {
            // テキストの背景を白くするための矩形を追加
            const bbox = this.getBBox();
            const padding = 3;
            
            d3.select(this.parentNode).insert("rect", "text")
                .attr("x", bbox.x - padding)
                .attr("y", bbox.y - padding)
                .attr("width", bbox.width + (padding * 2))
                .attr("height", bbox.height + (padding * 2))
                .attr("fill", "white")
                .attr("fill-opacity", 0.8);
        });

    // ノードを描画
    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(graph.nodes)
        .enter().append("g");

    // ノードの長方形を描画
    node.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => {
            // グループIDがある場合はそれに基づいて色を設定
            if (d.group) {
                return color(d.group);
            }
            return d.color || color(d.name);
        })
        .attr("stroke", "#000")
        .attr("stroke-dasharray", d => d.isVirtual ? "3,3" : "none")
        .on("mouseover", function(event, d) {
            // ノードをハイライト
            d3.select(this)
                .attr("stroke-width", 3);
            
            // 関連するリンクをハイライト
            link.filter(l => l.source === d || l.target === d)
                .attr("stroke-opacity", 0.5)
                // .attr("stroke-width", l => Math.max(1, l.width) + 2);
                .attr("stroke-width", 5);
        })
        .on("mouseout", function(event, d) {
            // ハイライトを元に戻す
            d3.select(this)
                .attr("stroke-width", 1);
            
            // リンクのハイライトを元に戻す
            link.attr("stroke-opacity", 0.2)
                // .attr("stroke-width", l => Math.max(1, l.width));
                .attr("stroke-width", 5);
        });

    // ノードにラベルを追加
    node.append("text")
        .attr("x", d => d.x0 - 6)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .text(d => {
            // グループIDがある場合は表示名を変更
            if (d.group && d.path) {
                return `${d.name} (${d.path})`;
            }
            return d.name;
        })
        .filter(d => d.x0 < width / 2)
        .attr("x", d => d.x1 + 6)
        .attr("text-anchor", "start");

    // ノードにホバー時のツールチップを追加
    node.append("title")
        .text(d => {
            let tooltip = `${d.name}\n値: ${d.value}`;
            if (d.path) {
                tooltip += `\n経路: ${d.path}`;
            }
            return tooltip;
        });

    // グループの背景を追加
    const groups = {};
    graph.nodes.forEach(d => {
        if (d.group && !groups[d.group]) {
            groups[d.group] = {
                name: d.group,
                nodes: []
            };
        }
        if (d.group) {
            groups[d.group].nodes.push(d);
        }
    });

    // グループごとに背景を描画
    Object.values(groups).forEach(group => {
        // グループ内のノードの範囲を計算
        const minX = d3.min(group.nodes, d => d.x0);
        const maxX = d3.max(group.nodes, d => d.x1);
        const minY = d3.min(group.nodes, d => d.y0);
        const maxY = d3.max(group.nodes, d => d.y1);
        
        // 背景を描画
        svg.insert("rect", ":first-child")
            .attr("x", minX - 5)
            .attr("y", minY - 5)
            .attr("width", maxX - minX + 10)
            .attr("height", maxY - minY + 10)
            .attr("fill", "none")
            .attr("stroke", color(group.name))
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("rx", 5)
            .attr("ry", 5);
    });
}

// メイン処理：データファイルを読み込んでチャートを描画
async function initializeCharts() {
    try {
        // データファイルのリストを取得
        const dataFiles = await getDataFilesList();
        
        if (dataFiles.length === 0) {
            document.getElementById('charts-container').innerHTML = 
                '<p>設定ファイルにデータファイルが見つかりませんでした。</p>';
            return;
        }
        
        // 各ファイルに対してチャートを作成
        for (let i = 0; i < dataFiles.length; i++) {
            const fileName = dataFiles[i];
            const filePath = `data/${fileName}`;
            
            // チャートのコンテナを作成
            const containerId = `chart-${i}`;
            const container = document.createElement('div');
            container.id = containerId;
            container.className = 'chart-wrapper';
            document.getElementById('charts-container').appendChild(container);
            
            // タイトル用のファイル名（.jsonを除去）
            const title = fileName.replace('.json', '');
            
            // データを読み込んでチャートを描画
            try {
                const response = await fetch(filePath);
                const data = await response.json();
                drawSankeyChart(data, containerId, title);
            } catch (error) {
                console.error(`${fileName}の読み込みに失敗しました:`, error);
                document.getElementById(containerId).innerHTML = 
                    `<p class="error">${fileName}の読み込みに失敗しました。</p>`;
            }
        }
    } catch (error) {
        console.error('チャートの初期化に失敗しました:', error);
        document.getElementById('charts-container').innerHTML = 
            '<p class="error">チャートの初期化に失敗しました。</p>';
    }
}

// ページ読み込み時にチャートを初期化
document.addEventListener('DOMContentLoaded', initializeCharts); 