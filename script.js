$(document).ready(function () {
    $('button.mode-switch').click(function () {
        $('body').toggleClass('dark');
    });

    $(".btn-close-right").click(function () {
        $(".right-side").removeClass("show");
        $(".expand-btn").addClass("show");
    });

    $(".expand-btn").click(function () {
        $(".right-side").addClass("show");
        $(this).removeClass("show");
    });

    // 初始化游戏按钮事件
    $("#init-game").on("click",function(){
        // 初始化游戏
        werewolfGame.initGame();
    });
    $("#game-start").click(function(){
        $("#init-game").off("click");
        // 开始游戏
        werewolfGame.gameStart();
    });

    // 大模型设置对话框事件处理
    $('#game-settings').click(function() {
        // 显示对话框
        $('#llm-settings-modal').show();
        // 获取模型列表
        refreshModelList();
    });

    // 关闭对话框
    $('.close-modal').click(function() {
        $('#llm-settings-modal').hide();
    });

    // 点击对话框外部关闭
    $(window).click(function(event) {
        if (event.target.id === 'llm-settings-modal') {
            $('#llm-settings-modal').hide();
        }
    });

    // 保存设置
    $('#save-llm-settings').click(function() {
        saveLlmSettings();
    });

    // 刷新模型列表按钮点击事件
    $(document).on('click', '#refresh-models', function() {
        refreshModelList();
    });

    // 加载已保存的设置
    loadSavedLlmSettings();
    
    // 点击消息图标显示游戏简介
    $('#game-message').click(function() {
        showGameIntroduction();
    });
});

// 默认模型列表，作为后备选项
const defaultModels = [
    { value: 'gpt-4-turbo', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'Deepseek-v3', label: 'Deepseek-v3' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'gemini-pro', label: 'Gemini Pro' }
];

// 刷新模型列表函数
function refreshModelList() {
    const proxyUrl = $('#api-base-url').val().trim() || localStorage.getItem('llmApiBaseUrl') || 'http://localhost:8000';
    const apiKey = $('#api-key').val().trim() || localStorage.getItem('llmApiKey') || '';
    const modelSelect = $('#model-name');
    const modelStatus = $('#model-status');
    
    // 显示加载状态
    modelStatus.text('正在加载模型列表...');
    modelStatus.css('color', '#4ecdc4');
    modelSelect.prop('disabled', true);
    
    // 构建获取模型列表的URL
    let modelsUrl = proxyUrl;
    if (!modelsUrl.endsWith('/')) {
        modelsUrl += '/';
    }
    modelsUrl += 'v1/models';
    
    // 发送请求获取模型列表
    $.ajax({
        url: modelsUrl,
        type: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        },
        timeout: 10000, // 10秒超时
        success: function(response) {
            // 尝试解析不同格式的响应
            let models = [];
            
            // 检查是否是标准OpenAI格式
            if (response.models && Array.isArray(response.models)) {
                models = response.models.map(model => ({
                    value: model.id,
                    label: model.id
                }));
            }
            // 检查是否是直接的模型数组
            else if (Array.isArray(response)) {
                models = response.map(model => ({
                    value: typeof model === 'string' ? model : model.id || model.value,
                    label: typeof model === 'string' ? model : model.name || model.label || (model.id || model.value)
                }));
            }
            // 检查是否是OpenAI格式的另一种变体
            else if (response.data && Array.isArray(response.data)) {
                models = response.data.map(model => ({
                    value: model.id,
                    label: model.id
                }));
            }
            
            if (models.length > 0) {
                // 清空并填充新的模型选项
                modelSelect.empty();
                models.forEach(model => {
                    const option = $('<option>').val(model.value).text(model.label);
                    // 设置默认选中的值
                    const savedModel = localStorage.getItem('llmModelName');
                    if (savedModel && savedModel === model.value) {
                        option.prop('selected', true);
                    }
                    modelSelect.append(option);
                });
                
                modelStatus.text(`从代理获取到 ${models.length} 个模型`);
                modelStatus.css('color', '#4ecdc4');
            } else {
                // 如果没有获取到模型，使用默认模型
                populateDefaultModels();
                
                modelStatus.text('未获取到有效模型，使用默认列表');
                modelStatus.css('color', '#ffd166');
            }
        },
        error: function(xhr, status, error) {
            // 请求失败，使用默认模型
            populateDefaultModels();
            
            modelStatus.text(`获取模型失败: ${error || status}`);
            modelStatus.css('color', '#ff6b6b');
        },
        complete: function() {
            // 恢复选择框状态
            modelSelect.prop('disabled', false);
        }
    });
}

// 填充默认模型列表
function populateDefaultModels() {
    const modelSelect = $('#model-name');
    modelSelect.empty();
    
    defaultModels.forEach(model => {
        const option = $('<option>').val(model.value).text(model.label);
        // 设置默认选中的值
        const savedModel = localStorage.getItem('llmModelName');
        if (savedModel && savedModel === model.value) {
            option.prop('selected', true);
        }
        modelSelect.append(option);
    });
}

// 保存大模型设置
function saveLlmSettings() {
    const apiBaseUrl = $('#api-base-url').val();
    const apiKey = $('#api-key').val();
    const modelName = $('#model-name').val();
    
    // 保存到localStorage
    localStorage.setItem('llmApiBaseUrl', apiBaseUrl);
    localStorage.setItem('llmApiKey', apiKey);
    localStorage.setItem('llmModelName', modelName);
    
    // 显示保存成功提示
    alert('大模型设置已保存！');
    
    // 关闭对话框
    $('#llm-settings-modal').hide();
}

// 加载已保存的大模型设置
function loadSavedLlmSettings() {
    const apiBaseUrl = localStorage.getItem('llmApiBaseUrl') || 'http://localhost:8000';
    const apiKey = localStorage.getItem('llmApiKey') || '';
    const modelName = localStorage.getItem('llmModelName') || 'gpt-4';
    
    $('#api-base-url').val(apiBaseUrl);
    $('#api-key').val(apiKey);
    
    // 初始化模型选择器为默认模型
    populateDefaultModels();
    // 设置已保存的模型
    if (modelName) {
        const modelExists = defaultModels.some(m => m.value === modelName);
        if (modelExists) {
            $('#model-name').val(modelName);
        }
    }
}

// 显示游戏简介弹窗
function showGameIntroduction() {
    // 创建游戏简介弹窗
    const gameIntroDialog = `
        <div id="game-intro-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        ">
            <div style="
                background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
                border-radius: 15px;
                padding: 30px;
                width: 90%;
                max-width: 700px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                color: #fff;
            ">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                    <h2 style="
                        color: #4ecdc4;
                        margin: 0;
                        font-size: 1.8rem;
                    ">
                        狼人杀游戏简介
                    </h2>
                    <button id="close-game-intro" style="
                        background: none;
                        border: none;
                        color: #666;
                        font-size: 1.5rem;
                        cursor: pointer;
                        padding: 5px;
                        transition: color 0.3s ease;
                    ">
                        ×
                    </button>
                </div>
                
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="img/20fc9fce9356bbc3e280f5abe8573e5d.png" alt="狼人杀游戏" style="
                        max-width: 100%;
                        max-height: 300px;
                        border-radius: 10px;
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                    ">
                </div>
                
                <div style="font-size: 1rem; line-height: 1.6; color: #e0e0e0;">
                    <p>狼人杀是一款多人参与的、以语言描述推动的、较量口才和分析判断能力的策略类桌面游戏。</p>
                    <p style="margin-top: 15px;">游戏背景设定在一个神秘的村庄，玩家将扮演不同的角色，包括狼人、预言家、女巫、猎人、平民等。</p>
                    <p style="margin-top: 15px;">游戏分为白天和夜晚两个阶段：</p>
                    <ul style="margin-top: 10px; padding-left: 20px;">
                        <li>夜晚：狼人可以选择击杀一名玩家；预言家可以查验一名玩家的身份；女巫可以使用解药或毒药；猎人如果被击杀可以开枪带走一人。</li>
                        <li>白天：所有玩家投票决定要放逐的玩家，被投票最多的玩家将被淘汰。</li>
                    </ul>
                    <p style="margin-top: 15px;">游戏目标：</p>
                    <ul style="margin-top: 10px; padding-left: 20px;">
                        <li>狼人阵营：杀死所有村民或神民。</li>
                        <li>好人阵营：放逐所有狼人。</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin-top: 25px;">
                    <button id="confirm-game-intro" style="
                        padding: 10px 30px;
                        background: linear-gradient(135deg, #4ecdc4, #45b7aa);
                        color: #fff;
                        border: none;
                        border-radius: 30px;
                        font-size: 1rem;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">
                        了解了
                    </button>
                </div>
            </div>
        </div>`;
        
    // 添加弹窗到body
    $('body').append(gameIntroDialog);
    
    // 关闭弹窗事件
    $('#close-game-intro, #confirm-game-intro').click(function() {
        $('#game-intro-modal').remove();
    });
    
    // 点击弹窗外部关闭
    $(document).on('click', '#game-intro-modal', function(event) {
        if (event.target.id === 'game-intro-modal') {
            $('#game-intro-modal').remove();
        }
    });
}

// 打开玩家AI设置对话框
function openPlayerAISettings(playerId) {
        const player = getPlayerById(playerId);
        // 获取该玩家已有的AI设置
        const existingSettings = gameState.playerAISettings[playerId] || {
            proxyUrl: '',
            apiKey: '',
            model: 'gpt-4'
        };
        
        // 默认模型列表，作为后备选项
        const defaultModels = [
            { value: 'gpt-4-turbo', label: 'GPT-4' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
            { value: 'Deepseek-v3', label: 'Deepseek-v3' },
            { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
            { value: 'gemini-pro', label: 'Gemini Pro' }
        ];
        
        // 生成默认模型选项HTML
        const defaultModelOptions = defaultModels.map(model => 
            `<option value="${model.value}" ${existingSettings.model === model.value ? 'selected' : ''}>${model.label}</option>`
        ).join('');
        
        // 创建设置对话框HTML
        const dialogHtml = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            ">
                <div style="
                    background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
                    border-radius: 15px;
                    padding: 30px;
                    width: 90%;
                    max-width: 500px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                ">
                    <h2 style="
                        color: #4ecdc4;
                        text-align: center;
                        margin-bottom: 20px;
                        font-size: 1.8rem;
                    ">
                        设置 ${player.name} 的AI参数
                    </h2>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="
                            display: block;
                            color: #fff;
                            margin-bottom: 8px;
                            font-weight: bold;
                        ">
                            AI代理地址:
                        </label>
                        <input 
                            type="text" 
                            id="proxy-url" 
                            value="${existingSettings.proxyUrl}"
                            placeholder="例如: http://localhost:3000/v1"
                            style="
                                width: 100%;
                                padding: 10px;
                                border: 2px solid #4a4a4a;
                                border-radius: 5px;
                                background-color: #3a3a3a;
                                color: #fff;
                                font-size: 1rem;
                            "
                        />
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="
                            display: block;
                            color: #fff;
                            margin-bottom: 8px;
                            font-weight: bold;
                        ">
                            API Key:
                        </label>
                        <input 
                            type="password" 
                            id="api-key" 
                            value="${existingSettings.apiKey}"
                            placeholder="sk-..."
                            style="
                                width: 100%;
                                padding: 10px;
                                border: 2px solid #4a4a4a;
                                border-radius: 5px;
                                background-color: #3a3a3a;
                                color: #fff;
                                font-size: 1rem;
                            "
                        />
                    </div>
                    
                    <div style="margin-bottom: 30px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <label style="
                                display: block;
                                color: #fff;
                                font-weight: bold;
                            ">
                                对话大模型:
                            </label>
                            <button 
                                id="refresh-models"
                                style="
                                    padding: 5px 15px;
                                    background: #4a4a4a;
                                    color: #fff;
                                    border: none;
                                    border-radius: 20px;
                                    font-size: 0.8rem;
                                    cursor: pointer;
                                    transition: all 0.3s ease;
                                "
                            >
                                刷新模型列表
                            </button>
                        </div>
                        <select 
                            id="model-select"
                            style="
                                width: 100%;
                                padding: 10px;
                                border: 2px solid #4a4a4a;
                                border-radius: 5px;
                                background-color: #3a3a3a;
                                color: #fff;
                                font-size: 1rem;
                            "
                        >
                            ${defaultModelOptions}
                        </select>
                        <div id="model-status" style="
                            margin-top: 5px;
                            font-size: 0.8rem;
                            color: #666;
                            text-align: right;
                        ">
                            使用默认模型列表
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button 
                            id="save-settings"
                            style="
                                padding: 10px 30px;
                                background: linear-gradient(135deg, #4ecdc4, #45b7aa);
                                color: #fff;
                                border: none;
                                border-radius: 30px;
                                font-size: 1rem;
                                font-weight: bold;
                                cursor: pointer;
                                transition: all 0.3s ease;
                            "
                        >
                            保存设置
                        </button>
                        <button 
                            id="cancel-settings"
                            style="
                                padding: 10px 30px;
                                background: #666;
                                color: #fff;
                                border: none;
                                border-radius: 30px;
                                font-size: 1rem;
                                font-weight: bold;
                                cursor: pointer;
                                transition: all 0.3s ease;
                            "
                        >
                            取消
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 创建对话框元素
        const dialog = $(dialogHtml);
        $('body').append(dialog);
        
        // 刷新模型列表函数
        function refreshModelList() {
            const proxyUrl = dialog.find('#proxy-url').val().trim();
            const apiKey = dialog.find('#api-key').val().trim();
            const modelSelect = dialog.find('#model-select');
            const modelStatus = dialog.find('#model-status');
            
            if (!proxyUrl) {
                modelStatus.text('请先输入代理地址');
                modelStatus.css('color', '#ff6b6b');
                return;
            }
            
            // 显示加载状态
            modelStatus.text('正在加载模型列表...');
            modelStatus.css('color', '#4ecdc4');
            modelSelect.prop('disabled', true);
            
            // 构建获取模型列表的URL
            let modelsUrl = proxyUrl;
            if (!modelsUrl.endsWith('/')) {
                modelsUrl += '/';
            }
            modelsUrl += 'v1/models';
            
            // 发送请求获取模型列表
            $.ajax({
                url: modelsUrl,
                type: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 10000, // 10秒超时
                success: function(response) {
                    // 尝试解析不同格式的响应
                    let models = [];
                    
                    // 检查是否是标准OpenAI格式
                    if (response.data && Array.isArray(response.data)) {
                        models = response.data.map(model => ({
                            value: model.id,
                            label: model.id
                        }));
                    }
                    // 检查是否是直接的模型数组
                    else if (Array.isArray(response)) {
                        models = response.map(model => ({
                            value: typeof model === 'string' ? model : model.id || model.value,
                            label: typeof model === 'string' ? model : model.name || model.label || (model.id || model.value)
                        }));
                    }
                    
                    if (models.length > 0) {
                        // 清空并填充新的模型选项
                        modelSelect.empty();
                        models.forEach(model => {
                            const option = $('<option>').val(model.value).text(model.label);
                            if (model.value === existingSettings.model) {
                                option.prop('selected', true);
                            }
                            modelSelect.append(option);
                        });
                        
                        modelStatus.text(`从代理获取到 ${models.length} 个模型`);
                        modelStatus.css('color', '#4ecdc4');
                    } else {
                        // 如果没有获取到模型，使用默认模型
                        modelSelect.empty();
                        defaultModels.forEach(model => {
                            const option = $('<option>').val(model.value).text(model.label);
                            if (model.value === existingSettings.model) {
                                option.prop('selected', true);
                            }
                            modelSelect.append(option);
                        });
                        
                        modelStatus.text('未获取到有效模型，使用默认列表');
                        modelStatus.css('color', '#ffd166');
                    }
                },
                error: function(xhr, status, error) {
                    // 请求失败，使用默认模型
                    modelSelect.empty();
                    defaultModels.forEach(model => {
                        const option = $('<option>').val(model.value).text(model.label);
                        if (model.value === existingSettings.model) {
                            option.prop('selected', true);
                        }
                        modelSelect.append(option);
                    });
                    
                    modelStatus.text(`获取模型失败: ${error || status}`);
                    modelStatus.css('color', '#ff6b6b');
                },
                complete: function() {
                    // 恢复选择框状态
                    modelSelect.prop('disabled', false);
                }
            });
        }
        
        // 绑定刷新模型列表按钮事件
        dialog.find('#refresh-models').click(refreshModelList);
        
        // 保存设置按钮点击事件
        dialog.find('#save-settings').click(function() {
            const proxyUrl = dialog.find('#proxy-url').val().trim();
            const apiKey = dialog.find('#api-key').val().trim();
            const model = dialog.find('#model-select').val();
            
            // 保存设置到gameState
            gameState.playerAISettings[playerId] = {
                proxyUrl: proxyUrl,
                apiKey: apiKey,
                model: model
            };
            
            // 显示保存成功提示
            alert(`${player.name} 的AI设置已保存！`);
            
            // 移除对话框
            dialog.remove();
        });
        
        // 取消按钮点击事件
        dialog.find('#cancel-settings').click(function() {
            dialog.remove();
        });
        
        // 点击对话框外部关闭
        dialog.click(function(e) {
            if (e.target === dialog[0]) {
                dialog.remove();
            }
        });
}