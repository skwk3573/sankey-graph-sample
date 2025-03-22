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
    
    // 高さ調整スライダーを追加
    controlDiv.append("span")
        .attr("class", "height-control-label")
        .style("margin-left", "20px")
        .text("グラフの高さ: ");
    
    // 初期高さ
    let chartHeight = 500;
    
    // スライダーを追加
    controlDiv.append("input")
        .attr("type", "range")
        .attr("min", "500")
        .attr("max", "2000")
        .attr("step", "100")
        .attr("value", chartHeight)
        .attr("class", "height-slider")
        .style("vertical-align", "middle")
        .style("margin-left", "5px")
        .on("input", function() {
            // スライダーの値を取得
            chartHeight = parseInt(this.value);
            // 高さ表示を更新
            heightValueDisplay.text(`${chartHeight}px`);
            // チャートを再描画
            redrawChart();
        });
    
    // 高さの値を表示
    const heightValueDisplay = controlDiv.append("span")
        .attr("class", "height-value")
        .style("margin-left", "5px")
        .style("min-width", "60px")
        .style("display", "inline-block")
        .text(`${chartHeight}px`);
    
    // チャート用のdiv要素を追加
    const chartDiv = container.append("div")
        .attr("class", "chart-container");
    
    // SVG要素とグラフを保持する変数
    let svg, graph, link, node;
    
    // チャートを描画する関数
    function redrawChart() {
        // 既存のSVGを削除
        chartDiv.html("");
        
        // SVGのサイズとマージンを設定
        const margin = {top: 50, right: 10, bottom: 10, left: 10};
        const width = 900 - margin.left - margin.right;
        const height = chartHeight - margin.top - margin.bottom;

        // SVG要素を作成
        svg = chartDiv.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // サンキーレイアウトを設定
        const sankey = d3.sankey()
            .nodeWidth(15)
            .nodePadding(10)
            .extent([[1, 1], [width - 1, height - 5]])
            // .nodeAlign(d3.sankeyRight)
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
        // 表示用の実際の値を保持しつつ、計算用の値を調整
        const links = data.links.map(link => {
            // 実際の値を保存
            const actualValue = link.value;
            
            // 計算用の値を調整（例：最小値を設定）
            // const calculationValue = Math.sqrt(actualValue, 10); // 最小値を10に設定
            const calculationValue = Math.sqrt(actualValue) * 3; // 平方根を取って5倍
            
            return {
                source: nodeById[link.source],
                target: nodeById[link.target],
                value: calculationValue, // 計算用の値
                actualValue: actualValue, // 実際の値（表示用）
                tooltip: link.tooltip
            };
        });
        
        // サンキーレイアウト用のデータ構造
        const sankeyData = {
            nodes: Object.values(nodeById),
            links: links
        };
        
        // サンキーレイアウトを適用
        graph = sankey(sankeyData);
        
        // ノードの段階を特定（x座標でグループ化）
        const stagePositions = [];
        const nodesByX = {};
        
        // ノードをx座標でグループ化
        graph.nodes.forEach(node => {
            const x = Math.round(node.x0);
            if (!nodesByX[x]) {
                nodesByX[x] = [];
                stagePositions.push(x);
            }
            nodesByX[x].push(node);
        });
        
        // x座標でソート
        stagePositions.sort((a, b) => a - b);
        
        // 段階ラベルを設定（オプション）
        const stageLabels = ["検索", "調査", "評価", "決定", "コンバージョン"];
        
        // 段階の区切り線と段階ラベルを追加
        if (stagePositions.length > 0) {
            for (let i = 0; i < stagePositions.length && i < stageLabels.length; i++) {
                const x = stagePositions[i];
                const nodes = nodesByX[x];
                
                if (nodes && nodes.length > 0) {
                    // 段階ラベルを追加
                    svg.append("text")
                        .attr("class", "stage-label")
                        .attr("x", nodes[0].x0)
                        .attr("y", 0)
                        .attr("dy", "-1em")
                        .attr("text-anchor", "start")
                        .attr("font-weight", "bold")
                        .text(stageLabels[i]);
                    
                    // 段階の区切り線を追加（最初のフェーズ以外）
                    if (i > 0) {
                        svg.append("line")
                            .attr("class", "stage-separator")
                            .attr("x1", nodes[0].x0 - 5)
                            .attr("y1", 0)
                            .attr("x2", nodes[0].x0 - 5)
                            .attr("y2", height)
                            .attr("stroke", "#ddd")
                            .attr("stroke-dasharray", "4,4");
                    }
                }
            }
        }
        
        // カラースケールを設定
        const color = d3.scaleOrdinal(d3.schemeCategory10);
        
        // リンク（フロー）を描画
        link = svg.append("g")
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
                // リンクをハイライト
                d3.select(this)
                    .attr("stroke-opacity", 0.8)
                    .attr("stroke-width", useUniformWidth ? 12 : Math.max(1, d.width) + 2);
                
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
                    .style("opacity", 0)
                    .style("z-index", 1000);
                
                // 実際の値（actualValue）を使用
                let tooltipContent = `<strong>値: ${d.actualValue || d.value}</strong><br>`;
                tooltipContent += `<div class="tooltip-source">From: ${d.source.name}</div>`;
                tooltipContent += `<div class="tooltip-target">To: ${d.target.name}</div>`;
                
                if (d.tooltip) {
                    tooltipContent += `<div class="tooltip-custom">${d.tooltip}</div>`;
                }
                
                tooltip.html(tooltipContent)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px")
                    .transition()
                    .duration(200)
                    .style("opacity", 1);
            })
            .on("mousemove", function(event) {
                // ツールチップの位置を更新
                d3.select(".tooltip")
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                // ハイライトを元に戻す
                d3.select(this)
                    .attr("stroke-opacity", 0.2)
                    .attr("stroke-width", d => useUniformWidth ? 10 : Math.max(1, d.width));
                
                // ツールチップを削除
                d3.select(".tooltip").remove();
            });
        
        // 経路の太さを更新する関数
        updateLinkWidth = function() {
            link.transition()
                .duration(500)
                .attr("stroke-width", d => useUniformWidth ? 10 : Math.max(1, d.width));
        };
        
        // ノードを描画
        node = svg.append("g")
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
                    .style("opacity", 0)
                    .style("z-index", 1000);
                
                let tooltipContent = `<strong>${d.name}</strong><br>値: ${d.value}`;
                if (d.id) {
                    tooltipContent += `<br>ID: ${d.id}`;
                }
                if (d.path) {
                    tooltipContent += `<br>経路: ${d.path}`;
                }
                
                tooltip.html(tooltipContent)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px")
                    .transition()
                    .duration(200)
                    .style("opacity", 1);
            })
            .on("mousemove", function(event) {
                // ツールチップの位置を更新
                d3.select(".tooltip")
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
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
                
                // ツールチップを削除
                d3.select(".tooltip").remove();
            });
        
        // ノードにラベルを追加
        node.append("text")
            .attr("x", d => d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2 - 15)
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
        
        // リンク上に値を表示するテキストを追加する部分を修正
        const linkLabels = svg.append("g")
            .attr("class", "link-labels")
            .selectAll("g")
            .data(graph.links)
            .enter().append("g");
            
        // 背景の矩形を透明化
        linkLabels.append("rect")
            .attr("class", "label-background")
            .attr("x", d => {
                const x = (d.source.x1 + d.target.x0) / 2;
                const width = String(d.actualValue || d.value).length * 8 + 10; // 元のサイズを維持
                return x - width / 2;
            })
            .attr("y", d => (d.y1 + d.y0) / 2 - 10) // 元のサイズを維持
            .attr("width", d => String(d.actualValue || d.value).length * 8 + 10) // 元のサイズを維持
            .attr("height", 20) // 元のサイズを維持
            .attr("fill", "white")
            .attr("fill-opacity", 0.5) // 透明度を上げる
            .attr("rx", 3) // 角を丸くする
            .attr("ry", 3);
            
        // テキストは元のサイズと設定を維持
        linkLabels.append("text")
            .attr("class", "link-value")
            .attr("x", d => (d.source.x1 + d.target.x0) / 2)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", "14px") // 元のサイズを維持
            .attr("font-weight", "bold")
            .attr("fill", "white")
            .attr("fill-opacity", "1")
            .attr("stroke", "black")
            .attr("stroke-width", "2px")
            .attr("stroke-opacity", "1")
            .attr("paint-order", "stroke fill")
            .attr("pointer-events", "none")
            .text(d => d.actualValue || d.value); // 実際の値を表示
    }
    
    // 初回描画
    redrawChart();
}

// 指定されたファイル名のJSONデータを読み込んでチャートを描画する関数
async function loadAndDrawChart(fileName) {
    try {
        // ファイル名に.jsonが含まれていない場合は追加
        if (!fileName.endsWith('.json')) {
            fileName += '.json';
        }
        
        const filePath = `data/${fileName}`;
        
        // データを読み込む前にレスポンスを確認
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`ファイル ${fileName} が見つかりません (${response.status})`);
        }
        
        // JSONデータを解析
        const data = await response.json();
        
        // チャートのコンテナを作成（データが正常に読み込めた後に作成）
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
        
        // チャートを描画
        drawSankeyChart(data, containerId, title);
        
        return true;
    } catch (error) {
        console.error(`${fileName}の読み込みに失敗しました:`, error);
        alert(`エラー: ${fileName}の読み込みに失敗しました。\n${error.message}`);
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