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
    
    // 削除ボタンを追加
    container.append("button")
        .attr("class", "delete-btn")
        .text("削除")
        .on("click", function() {
            // チャートコンテナを削除
            container.remove();
        });
    
    // 切り替えボタンを追加
    const controlDiv = container.append("div")
        .attr("class", "chart-controls");
    
    // 初期状態は均一の太さ
    let useUniformWidth = true;
    
    // 切り替えボタンを追加
    controlDiv.append("button")
        .attr("class", "toggle-link-width")
        .text("経路の太さ: 均一")
        .on("click", function() {
            useUniformWidth = !useUniformWidth;
            d3.select(this).text(`経路の太さ: ${useUniformWidth ? '均一' : '流量比例'}`);
            updateLinkWidth();
        });
    
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
    // ノードのidとnameを処理
    const nodeById = {};
    
    // まずノードのマッピングを作成
    data.nodes.forEach(node => {
        nodeById[node.id] = { ...node };
    });
    
    // リンクのsourceとtargetをオブジェクト参照に変換
    const links = data.links.map(link => ({
        source: nodeById[link.source],
        target: nodeById[link.target],
        value: link.value,
        tooltip: link.tooltip
    }));
    
    // サンキーレイアウト用のデータ構造
    const sankeyData = {
        nodes: Object.values(nodeById),
        links: links
    };
    
    // サンキーレイアウトを適用
    const graph = sankey(sankeyData);
    
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
    
    // 段階のラベルを動的に生成
    let stageLabels = ["流入キーワード", "情報収集", "評価検討", "意思決定"];
    
    // 意思決定以降のフェーズ数を計算
    const decisionPhaseIndex = 3; // 意思決定は4番目（インデックスは3）
    const postDecisionPhases = stagePositions.length - (decisionPhaseIndex + 1);
    
    // 意思決定以降のフェーズラベルを設定
    if (postDecisionPhases > 0) {
        if (postDecisionPhases === 1) {
            // 意思決定以降のフェーズが1つの場合
            stageLabels.push("CV");
        } else {
            // 意思決定以降のフェーズが複数の場合
            for (let i = 1; i < postDecisionPhases; i++) {
                stageLabels.push(`mCV${i}`);
            }
            stageLabels.push("CV"); // 最後のフェーズは常にCV
        }
    }
    
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
        .attr("stroke-width", d => useUniformWidth ? 10 : Math.max(1, d.width))
        .on("mouseover", function(event, d) {
            // すべてのリンクの透明度を下げる
            link.attr("stroke-opacity", 0.05);
            
            // 選択されたリンクをハイライト
            d3.select(this)
                .attr("stroke-opacity", 0.8)
                .attr("stroke-width", useUniformWidth ? 12 : Math.max(1, d.width) + 2);
            
            // 関連するノードをハイライト
            node.filter(n => n === d.source || n === d.target)
                .select("rect")
                .attr("stroke-width", 3);
            
            // すべてのリンクラベルを非表示にする
            svg.selectAll(".link-value, .label-background").style("opacity", 0);
            
            // 選択されたリンクのラベルだけを表示する
            svg.selectAll(".link-value").filter(l => l === d).style("opacity", 1);
            svg.selectAll(".label-background").filter(function() {
                const textElement = d3.select(this.nextSibling);
                return textElement.datum() === d;
            }).style("opacity", 0.8);
            
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
            // すべてのリンクの透明度を元に戻す
            link.attr("stroke-opacity", 0.2);
            
            // 選択されたリンクのスタイルを元に戻す
            d3.select(this)
                .attr("stroke-width", useUniformWidth ? 10 : Math.max(1, d.width));
            
            // ノードのハイライトを元に戻す
            node.select("rect")
                .attr("stroke-width", 1);
            
            // すべてのリンクラベルを表示する
            svg.selectAll(".link-value, .label-background").style("opacity", 1);
            
            // ツールチップを削除
            d3.select(".tooltip").remove();
        });

    // 経路の太さを更新する関数
    function updateLinkWidth() {
        link.transition()
            .duration(500)
            .attr("stroke-width", d => useUniformWidth ? 10 : Math.max(1, d.width));
    }

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
            
            // すべてのリンクの透明度を下げる
            link.attr("stroke-opacity", 0.05);
            
            // 関連するリンクをハイライト
            const relatedLinks = link.filter(l => l.source === d || l.target === d)
                .attr("stroke-opacity", 0.8)
                .attr("stroke-width", l => useUniformWidth ? 12 : Math.max(1, l.width) + 2);
                
            // すべてのリンクラベルを非表示にする
            svg.selectAll(".link-value, .label-background").style("opacity", 0);
            
            // 関連するリンクのラベルだけを表示する
            svg.selectAll(".link-value").filter(l => l.source === d || l.target === d).style("opacity", 1);
            svg.selectAll(".label-background").filter(function() {
                const textElement = d3.select(this.nextSibling);
                const textData = textElement.datum();
                return textData.source === d || textData.target === d;
            }).style("opacity", 0.8);
        })
        .on("mouseout", function(event, d) {
            // ハイライトを元に戻す
            d3.select(this)
                .attr("stroke-width", 1);
            
            // リンクのハイライトを元に戻す
            link.attr("stroke-opacity", 0.2)
                .attr("stroke-width", l => useUniformWidth ? 10 : Math.max(1, l.width));
            
            // すべてのリンクラベルを表示する
            svg.selectAll(".link-value, .label-background").style("opacity", 1);
        });

    // ノードにラベルを追加
    node.append("text")
        .attr("x", d => d.x0 - 6)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .text(d => {
            // 表示名を使用
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
            if (d.id) {
                tooltip += `\nID: ${d.id}`;
            }
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

    // リンク上に値を表示するテキストを追加（最後に描画して最前面に表示）
    const linkLabels = svg.append("g")
        .attr("class", "link-labels")
        .selectAll("g")
        .data(graph.links)
        .enter().append("g");
        
    // 背景の矩形を追加
    linkLabels.append("rect")
        .attr("class", "label-background")
        .attr("x", d => {
            const x = (d.source.x1 + d.target.x0) / 2;
            const width = String(d.value).length * 8 + 10; // 値の長さに基づいて幅を計算
            return x - width / 2;
        })
        .attr("y", d => (d.y1 + d.y0) / 2 - 10)
        .attr("width", d => String(d.value).length * 8 + 10) // 値の長さに基づいて幅を計算
        .attr("height", 20)
        .attr("fill", "white")
        .attr("fill-opacity", 1)
        .attr("rx", 3) // 角を丸くする
        .attr("ry", 3);
        
    // テキストを追加
    linkLabels.append("text")
        .attr("class", "link-value")
        .attr("x", d => (d.source.x1 + d.target.x0) / 2)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .attr("fill-opacity", "1")
        .attr("stroke", "black")
        .attr("stroke-width", "2px")
        .attr("stroke-opacity", "1")
        .attr("paint-order", "stroke fill")
        .attr("pointer-events", "none")
        .text(d => d.value);
}

// 指定されたファイル名のJSONデータを読み込んでチャートを描画する関数
async function loadAndDrawChart(fileName) {
    try {
        // ファイル名に.jsonが含まれていない場合は追加
        if (!fileName.endsWith('.json')) {
            fileName += '.json';
        }
        
        const filePath = `data/${fileName}`;
        
        // チャートのコンテナを作成
        const containerId = `chart-${Date.now()}`; // ユニークなIDを生成
        const container = document.createElement('div');
        container.id = containerId;
        container.className = 'chart-wrapper';
        
        // コンテナを最上部に追加（既存のチャートの前に）
        const chartsContainer = document.getElementById('charts-container');
        if (chartsContainer.firstChild) {
            chartsContainer.insertBefore(container, chartsContainer.firstChild);
        } else {
            chartsContainer.appendChild(container);
        }
        
        // タイトル用のファイル名（.jsonを除去）
        const title = fileName.replace('.json', '');
        
        // データを読み込んでチャートを描画
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`ファイル ${fileName} が見つかりません (${response.status})`);
        }
        
        const data = await response.json();
        drawSankeyChart(data, containerId, title);
        
        return true;
    } catch (error) {
        console.error(`${fileName}の読み込みに失敗しました:`, error);
        alert(`エラー: ${fileName}の読み込みに失敗しました。\n${error.message}`);
        
        // エラーが発生した場合、空のコンテナを削除
        const container = document.getElementById(containerId);
        if (container) {
            container.remove();
        }
        
        return false;
    }
}

// オートコンプリート機能を設定する関数
async function setupAutocomplete() {
    const input = document.getElementById('chart-filename');
    const autocompleteList = document.getElementById('autocomplete-list');
    
    // 利用可能なデータファイルのリストを取得
    const dataFiles = await getDataFilesList();
    
    // ファイル名から.jsonを除去したリストを作成
    const fileNames = dataFiles.map(file => file.replace('.json', ''));
    
    // 入力フィールドにフォーカスが当たったときにすべての候補を表示
    input.addEventListener('focus', function() {
        showAllFiles();
    });
    
    // 入力フィールドの値が変更されたときにフィルタリングされた候補を表示
    input.addEventListener('input', function() {
        if (this.value.trim() === '') {
            showAllFiles();
        } else {
            showFilteredFiles(this.value);
        }
    });
    
    // 入力フィールドからフォーカスが外れたときにリストを非表示（少し遅延させる）
    input.addEventListener('blur', function() {
        setTimeout(() => {
            autocompleteList.style.display = 'none';
        }, 200);
    });
    
    // すべてのファイル候補を表示する関数
    function showAllFiles() {
        autocompleteList.innerHTML = '';
        
        if (fileNames.length > 0) {
            autocompleteList.style.display = 'block';
            
            fileNames.forEach(name => {
                const div = document.createElement('div');
                div.textContent = name;
                div.addEventListener('click', function() {
                    input.value = name;
                    autocompleteList.style.display = 'none';
                });
                autocompleteList.appendChild(div);
            });
        } else {
            autocompleteList.style.display = 'none';
        }
    }
    
    // 入力値でフィルタリングしたファイル候補を表示する関数
    function showFilteredFiles(inputValue) {
        autocompleteList.innerHTML = '';
        
        // 入力値に一致するファイル名をフィルタリング
        const matchingFiles = fileNames.filter(name => 
            name.toLowerCase().includes(inputValue.toLowerCase())
        );
        
        if (matchingFiles.length > 0) {
            autocompleteList.style.display = 'block';
            
            matchingFiles.forEach(name => {
                const div = document.createElement('div');
                div.textContent = name;
                div.addEventListener('click', function() {
                    input.value = name;
                    autocompleteList.style.display = 'none';
                });
                autocompleteList.appendChild(div);
            });
        } else {
            autocompleteList.style.display = 'none';
        }
    }
}

// ページ読み込み時の初期化処理
document.addEventListener('DOMContentLoaded', function() {
    // オートコンプリート機能を設定
    setupAutocomplete();
    
    // フォーム送信イベントを処理
    document.getElementById('add-chart-form').addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const fileNameInput = document.getElementById('chart-filename');
        const fileName = fileNameInput.value.trim();
        
        if (fileName) {
            await loadAndDrawChart(fileName);
            // 入力フィールドをクリア
            fileNameInput.value = '';
        }
    });
}); 