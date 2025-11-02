// 大模型（聊天接口）代理地址，apikey和大模型配置
var url= "";
var apikey= "";
var model = ""

// 初始化聊天历史
var chatHistory = [];
var aiChat = [];
var requestChain = [];
var chainIndex = 0;
var chatState = 0; // 0表示空闲状态，1表示对话ing，2表示loading，3表示工具调用ing
var $chatArea = $('#chat-area');
var $sendButton = $('#send-message'); // 发送按钮的jQuery对象
var $chatInput = $('#message-input'); // 聊天输入框的jQuery对象

// 初始化DOM元素和事件监听
$(document).ready(function () {
    // chatHistory.push({
    //     "role": "system",
    //     "content": getPrompt("lyc", "1", "当前是黑夜，你是狼人，你必须要使用工具杀死一名玩家。目前玩家1、玩家2、玩家3、玩家4存活，其中玩家2是预言家")
    // });
    // 初始状态更新
    updateSendButtonState();

    // 设置发送按钮点击事件
    $sendButton.on('click', function () {
        if (chatState === 0) { // 只有在空闲状态才能发送消息
            const message = $chatInput.val().trim();
            if (message) {
                sendAIMessage(message);
                $chatInput.val('');
            }
        }
    });

    // 设置回车键发送消息
    $chatInput.on('keypress', function (e) {
        if (e.which === 13 && chatState === 0) { // 只有在空闲状态才能发送消息
            $sendButton.click();
        }
    });
});

// 更新发送按钮状态
function updateSendButtonState() {
    if ($sendButton) {
        if (chatState === 0) { // 空闲状态
            $sendButton.prop('disabled', false);
            $sendButton.css('opacity', '1');
        } else { // 对话中、加载中或工具调用中状态
            $sendButton.prop('disabled', true);
            $sendButton.css('opacity', '0.5');
        }
    }
}


// 发送消息函数
function sendAIMessage(userMessage,player,fn) {
    if (!userMessage) return;
    // 更改状态
    chatState = 9;
    // 添加用户消息到聊天记录
    addMessageToChat('系统', userMessage);

    // 添加用户消息到历史记录
    chatHistory.push({"role": "user", "content": userMessage});

    // 显示AI正在输入
    showTypingIndicator();

    // 使用流式API调用
    streamAPIRequest(player,fn);
}

// 流式API请求函数
function streamAPIRequest(player,fn) {
    // 构建请求参数
    const requestData = {
        "model": model,
        "messages": chatHistory,
        "temperature": 1,
        "top_p": 1,
        "stream": true,
        "stream_options": {
            "include_usage": false
        }
    };

    let aiResponse = "";
    let aiMessageElement = null;
    let toolCallDetected = false;
    let currentToolCall = "";
    let reasoningContent = "";
    let reasoningDetected = false;


    fetch(url, {
        method: "POST",
        headers: {
            "authorization": "Bearer "+apikey,
            "content-type": "application/json"
        },
        body: JSON.stringify(requestData)
    })
        .then(response => {
            chatState = 1;
            updateSendButtonState();
            if (!response.ok) {
                chatState = 0;
                updateSendButtonState();
                player.isEnded = true;
                if(fn){
                    fn();
                }
                throw new Error(`openai调用错误: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // 移除正在输入的指示器
            removeTypingIndicator();

            // 创建AI消息元素但不添加到DOM中，用于实时更新
            aiMessageElement = $('<div>').addClass('message ai-message');

            return reader.read().then(function processText({done, value}) {
                if (done) {
                    // 处理完所有数据
                    chatState = 0;
                    if (aiResponse.trim()) {
                        // 最终处理消息并添加到DOM
                        finalizeAiMessage(aiResponse, aiMessageElement, reasoningContent);

                        // 添加到历史记录
                        const assistantMessage = {"role": "assistant", "content": aiResponse};
                        if (reasoningContent && reasoningContent.trim()) {
                            assistantMessage.reasoning_content = reasoningContent;
                        }
                        chatHistory.push(assistantMessage);
                        if(player){
                            player.isEnded = true;
                            if(gameState.currentPhase === "discuss"){
                                player.discuss.push(aiResponse);
                            }
                            aiChat.push({"role": player.role, "input": chatHistory,"output": aiResponse});
                        }
                        if(fn){
                            fn();
                        }
                    } else {
                        addMessageToChat('AI', '抱歉，未获取到响应内容。');
                    }
                    updateSendButtonState();
                    return;
                }

                // 解码获取的数据
                const chunk = decoder.decode(value, {stream: true});

                // 分割成多行（每个事件一行）
                const lines = chunk.split('\n');

                lines.forEach(line => {
                    // 过滤空行和非事件流格式的行
                    if (line.trim() === '' || !line.startsWith('data: ')) {
                        return;
                    }

                    try {
                        // 检查是否是[DONE]消息
                        if (line.substring(5).trim() === '[DONE]') {
                            return;
                        }

                        // 移除前缀并解析JSON
                        const data = JSON.parse(line.substring(5).trim());
                        
                        // 检查是否有finish_reason为stop或length的情况
                        if (data.choices && data.choices.length > 0 && (data.choices[0].finish_reason === 'stop' || data.choices[0].finish_reason === 'length')) {
                            return;
                        }

                        // 检查是否有内容
                        if (data.choices && data.choices.length > 0) {
                            let contentChunk = '';
                            // 检查常规内容
                            if (data.choices[0].delta.content !== undefined) {
                                contentChunk = data.choices[0].delta.content;

                                // 累计响应内容
                                aiResponse += contentChunk;
                            }
                            
                            // 检查是否有推理内容（用于流式响应）
                            if (data.choices[0].delta.reasoning_content !== undefined) {
                                reasoningContent += data.choices[0].delta.reasoning_content;
                                reasoningDetected = true;
                            }
                            
                            // 检查是否有推理内容（用于非流式或完整响应）
                            if (data.choices[0].message && data.choices[0].message.reasoning_content) {
                                reasoningContent = data.choices[0].message.reasoning_content;
                                reasoningDetected = true;
                            }

                            // 处理工具调用检测
                            if (!toolCallDetected && aiResponse) {
                                const toolStartIndex = aiResponse.indexOf('<tool_use>');
                                if (toolStartIndex !== -1) {
                                    toolCallDetected = true;
                                    currentToolCall = contentChunk.substring(toolStartIndex - (aiResponse.length - contentChunk.length));

                                    // 显示工具调用loading状态
                                    if (aiMessageElement) {
                                        const loadingIndicator = $('<div>').attr('id', 'tool-loading').addClass('tool-loading').text('玩家行动中...');
                                        aiMessageElement.append(loadingIndicator);

                                        // 检查消息元素是否已添加到DOM
                                        if (!aiMessageElement.parent().length) {
                                            $chatArea.append(aiMessageElement);
                                            //$chatArea.scrollTop($chatArea[0].scrollHeight);
                                        }
                                    }
                                }
                            } else {
                                currentToolCall += contentChunk;
                                const toolEndIndex = currentToolCall.indexOf('</tool_use>');
                                if (toolEndIndex !== -1) {
                                    toolCallDetected = false;
                                    // 工具调用已完成，处理它
                                    const processedToolCall = processToolCall(currentToolCall);

                                    // 替换原始工具调用文本为处理后的HTML
                                    const responseWithoutToolCall = aiResponse.replace(currentToolCall, processedToolCall);

                                    // 移除工具调用loading状态并更新消息显示
                                    updateAiMessage(responseWithoutToolCall, aiMessageElement, reasoningContent);
                                }
                            }

                            // 如果没有工具调用或者工具调用已处理完成，更新消息显示
                            if (!toolCallDetected) {
                                updateAiMessage(aiResponse, aiMessageElement, reasoningContent);
                            }
                        }
                    } catch (error) {
                        chatState = 0;
                        console.error('解析流式响应错误:', error);
                    }
                });

                // 继续读取
                return reader.read().then(processText);
            });
        })
        .catch(error => {
            chatState = 0;
            // 移除正在输入的指示器
            removeTypingIndicator();

            // 显示错误信息
            addMessageToChat('AI', `请求失败: ${error.message}\n请确保Ollama服务已启动并在127.0.0.1:11434端口运行。`);
            console.error('API请求失败:', error);
        });
}

// 获取函数参数名称的辅助函数
function getParamNames(func) {
    try {
        // 将函数转换为字符串
        const funcStr = func.toString();

        // 提取函数参数部分
        const paramsMatch = funcStr.match(/function\s*[^(]*\(\s*([^)]*)\)/m);
        if (!paramsMatch || !paramsMatch[1]) {
            return [];
        }

        // 解析参数名并去除空白
        const paramNames = paramsMatch[1].split(',')
            .map(param => param.trim())
            .filter(param => param.length > 0);

        return paramNames;
    } catch (e) {
        console.error('获取函数参数名失败:', e);
        return [];
    }
}

// 处理工具调用的函数
function processToolCall(toolCallText) {
    try {
        // 提取工具名称和参数
        const nameMatch = toolCallText.match(/<name>(.*?)<\/name>/);
        const argsMatch = toolCallText.match(/<arguments>(.*?)<\/arguments>/);

        if (nameMatch && argsMatch) {
            const toolName = nameMatch[1];
            const argumentsStr = argsMatch[1];
            let toolJson = "";
            let targetFunction = window[toolName];
            if (typeof targetFunction === 'function') {
                try {
                    // 尝试将argumentsStr解析为JSON对象
                    const argsObj = JSON.parse(argumentsStr);

                    // 获取目标函数的参数数量
                    const argCount = targetFunction.length;

                    if (argCount === 1) {
                        // 如果函数只接受一个参数，直接传递整个参数对象
                        toolJson = targetFunction(argsObj);
                    } else {
                        // 如果函数接受多个参数，尝试从对象中提取参数
                        // 获取函数的参数名
                        const paramNames = getParamNames(targetFunction);

                        if (paramNames && paramNames.length > 0) {
                            // 准备参数数组
                            const params = paramNames.map(name => argsObj[name] || undefined);
                            // 使用动态参数调用函数
                            toolJson = targetFunction.apply(null, params);
                        } else {
                            // 如果无法获取参数名，回退到使用整个对象作为参数
                            toolJson = targetFunction(argsObj);
                        }
                    }
                } catch (e) {
                    // 如果JSON解析失败或调用出错，记录错误并使用原方式调用
                    console.error('函数调用错误:', e);
                    toolJson = targetFunction(argumentsStr);
                }
            } else {
                toolJson = "方法没有找到：" + toolName;
            }
            console.log("工具调用：", toolName, argumentsStr, "结果：", toolJson);
            // 返回处理后的HTML，添加工具调用提示
            return `<div class="tool-use">工具调用中
&lt;tool_use&gt;
&lt;name&gt;${toolName}&lt;/name&gt;
&lt;arguments&gt;${argumentsStr}&lt;/arguments&gt;
&lt;/tool_use&gt;</div>`;
        }
    } catch (error) {
        console.error('处理工具调用错误:', error);
    }

    // 如果处理失败，返回原始文本
    return toolCallText;
}

// 更新AI消息显示的函数（流式）
function updateAiMessage(content, messageElement, reasoningContent = "") {
    // 清空消息元素
    messageElement.empty();
    
    // 如果有推理内容，先添加到消息中
    if (reasoningContent && reasoningContent.trim()) {
        const reasoningElement = $('<div>').addClass('reasoning-content')
            .css({
                'margin-top': '10px',
                'padding': '10px',
                'background-color': '#f0f0f0',
                'border-left': '4px solid #4ecdc4',
                'border-radius': '4px',
                'font-style': 'italic',
                'color': '#333',
                'margin-bottom': '10px'
            })
            .text(`推理过程: ${reasoningContent}`);
        messageElement.append(reasoningElement);
    }

    // 添加内容（支持HTML格式，用于工具调用高亮）
    messageElement.append($('<div>').html(content));

    // 检查消息元素是否已添加到DOM
    if (!messageElement.parent().length) {
        $chatArea.append(messageElement);
    }

    // 滚动到底部
    //$chatArea.scrollTop($chatArea[0].scrollHeight);
}

// 最终处理AI消息的函数
function finalizeAiMessage(content, messageElement, reasoningContent = "") {

    // 清空消息元素
    messageElement.empty();
    
    // 如果有推理内容，先添加到消息中
    if (reasoningContent && reasoningContent.trim()) {
        const reasoningElement = $('<div>').addClass('reasoning-content')
            .css({
                'margin-top': '10px',
                'padding': '10px',
                'background-color': '#f0f0f0',
                'border-left': '4px solid #4ecdc4',
                'border-radius': '4px',
                'font-style': 'italic',
                'color': '#333',
                'margin-bottom': '10px'
            })
            .text(`推理过程: ${reasoningContent}`);
        messageElement.append(reasoningElement);
    }

    // 处理消息内容，提取并高亮显示工具调用
    const toolUseRegex = /<tool_use>\s*<name>(.*?)<\/name>\s*<arguments>(.*?)<\/arguments>\s*<\/tool_use>/gs;
    let match;
    let toolCalls = [];

    while ((match = toolUseRegex.exec(content)) !== null) {
        toolCalls.push({name: match[1], arguments: match[2]});
    }

    // 如果有工具调用，将其单独显示
    if (toolCalls.length > 0) {
        const contentParts = content.split(toolUseRegex);

        // 添加普通文本部分
        if (contentParts[0].trim()) {
            messageElement.append($('<div>').text(contentParts[0]));
        }

        // 添加每个工具调用
        for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];
            const toolElement = $('<div>').addClass('tool-use')
                .text(`<tool_use>\n<name>${toolCall.name}</name>\n<arguments>${toolCall.arguments}</arguments>\n</tool_use>`);
            messageElement.append(toolElement);

            // 如果还有普通文本部分，添加它
            if (contentParts[i * 3 + 3] && contentParts[i * 3 + 3].trim()) {
                messageElement.append($('<div>').text(contentParts[i * 3 + 3]));
            }
        }
    } else {
        // 没有工具调用，直接添加内容
        messageElement.append($('<div>').html(content));
    }
    
    // 检查消息元素是否已添加到DOM
    if (!messageElement.parent().length) {
        $chatArea.append(messageElement);
    }

    // 滚动到底部
    // $chatArea.scrollTop($chatArea[0].scrollHeight);
}

function addMessageToChat(sender, content, reasoningContent = "") {
    // 创建消息容器
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message-wrapper');
    messageContainer.classList.add('reverse');
    
    // 创建头像区域
    const profilePicture = document.createElement('div');
    profilePicture.classList.add('profile-picture');
    const img = document.createElement('img');
    img.alt = 'participant';
    img.src = 'img/npc_dota_hero_void_spirit.gif';
    profilePicture.appendChild(img);
    messageContainer.appendChild(profilePicture);
    
    // 创建消息内容区
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-content');
    
    // 添加名称
    const nameElement = document.createElement('p');
    nameElement.classList.add('name');
    nameElement.textContent = sender;
    messageElement.appendChild(nameElement);
    
    // 创建消息文本区域
    const messageTextElement = document.createElement('div');
    messageTextElement.classList.add('message');

    if (sender === '系统' || sender === 'AI') {
        // 系统或AI消息样式
        messageTextElement.classList.add(sender === '系统' ? 'system-message' : 'user-message');

        if (sender === 'AI' && content.includes('tool_use:')) {
            // 提取工具调用部分
            const toolUseMatch = content.match(/tool_use:\s*([^\n]+)/);
            if (toolUseMatch && toolUseMatch[1]) {
                const toolUseContent = toolUseMatch[1];

                // 创建一个特殊的div来显示工具调用
                const toolCallElement = document.createElement('div');
                toolCallElement.classList.add('tool-call');
                toolCallElement.textContent = `工具调用: ${toolUseContent}`;
                messageTextElement.appendChild(toolCallElement);
            }
        }

        // 添加内容
        const contentNode = document.createTextNode(content);
        messageTextElement.appendChild(contentNode);
        
        // 如果有推理内容，添加到消息中
        if (reasoningContent && reasoningContent.trim()) {
            const reasoningElement = document.createElement('div');
            reasoningElement.className = 'reasoning-content';
            reasoningElement.style.marginTop = '10px';
            reasoningElement.style.padding = '10px';
            reasoningElement.style.backgroundColor = '#f0f0f0';
            reasoningElement.style.borderLeft = '4px solid #4ecdc4';
            reasoningElement.style.borderRadius = '4px';
            reasoningElement.style.fontStyle = 'italic';
            reasoningElement.style.color = '#333';
            reasoningElement.style.marginBottom = '10px';
            reasoningElement.textContent = `推理过程: ${reasoningContent}`;
            messageTextElement.appendChild(reasoningElement);
        }
    } else {
        // 用户消息
        messageTextElement.classList.add('user-message');
        const contentNode = document.createTextNode(content);
        messageTextElement.appendChild(contentNode);
    }



    // 将消息文本区域添加到消息内容区
    messageElement.appendChild(messageTextElement);

    // 将消息内容区添加到容器
    messageContainer.appendChild(messageElement);

    // 添加到聊天区域
    $chatArea.append(messageContainer);
    //$chatArea.scrollTop($chatArea[0].scrollHeight);
}

// 显示AI正在输入的指示器
function showTypingIndicator() {
    chatState = 2;
    updateSendButtonState();
    const typingIndicator = $('<div>').attr('id', 'typing-indicator').addClass('typing-indicator');

    // 添加三个动画点
    for (let i = 0; i < 3; i++) {
        typingIndicator.append($('<div>').addClass('typing-dot'));
    }

    $chatArea.append(typingIndicator);
    //$chatArea.scrollTop($chatArea[0].scrollHeight);
}

// 移除AI正在输入的指示器
function removeTypingIndicator() {
    chatState = 1;
    updateSendButtonState();
    $('#typing-indicator').remove();
}
