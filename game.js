// 狼人杀游戏逻辑

// 游戏角色定义
const ROLES = {
    WEREWOLF: '狼人',
    VILLAGER: '平民',
    SEER: '预言家',
    WITCH: '女巫',
    HUNTER: '猎人'
};

// 游戏状态
let gameState = {
    players: [],
    isNight: false,
    nightPhase: 0,
    currentPhase: null,
    wolfNumber: 0,
    nightTarget: null,
    nightAction: null
};

let action = {
    wolfAction: [],
    prophetAction: [],
    witchAction: [],
    hunterAction: [],
    voteAction:[]
}

let playerTemp=[];

// 初始化游戏
function initGame() {

    // 创建8名玩家
    gameState.players = [];
    
    // 分配身份
    const rolesToAssign = [
        ROLES.WEREWOLF, ROLES.WEREWOLF,  // 2个狼人
        ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER,  // 3个平民
        ROLES.SEER,  // 1个预言家
        ROLES.WITCH,  // 1个女巫
        ROLES.HUNTER  // 1个猎人
    ];
    // 统计狼人数量
    gameState.wolfNumber = rolesToAssign.filter(role => role === ROLES.WEREWOLF).length;
    // 随机打乱身份顺序
    shuffleArray(rolesToAssign);
    
    // 为玩家分配身份
    for (let i = 0; i < 8; i++) {
        let player = {
            id: i + 1,
            name: `玩家${i + 1}`,
            role: rolesToAssign[i],
            discuss: [],
            isAlive: true,
            isEnded: false,
            hasVoted: false,
            voteCount: 0,
            voteTarget: null,
            wolfTarget: null,
            prophetTarget: null,
            witchTarget: null,
            hunterTarget: null,
            currentPlayer: false,
            witchPoison: false, // 女巫毒药
            witchAntidote: false // 女巫解药
        };
        if(rolesToAssign[i] === ROLES.WITCH){
            player.witchPoison = true;
            player.witchAntidote = true;
        }
        gameState.players.push(player);
    }
    // 生成参与者
    generatePlayerParticipants();
}

function gameStart() {
    initActions();
    // 开始游戏，进入夜晚阶段
    startNightPhase();
}

function initActions() {
    // 初始化狼人行动
    window.wolf_kill = function (wolfNo, targetNo) {
        console.log("wolf_kill,"+wolfNo+","+targetNo)
        let targetPlayer = gameState.players.find(player => player.id == targetNo);
        targetPlayer.wolfTarget = wolfNo;
        action.wolfAction.push({
            wolfNo : wolfNo,
            targetNo : targetNo,
            action : "wolf_kill",
            nightPhase : gameState.nightPhase
        });
        targetPlayer.isAlive = false;
        $(`.participant-${player.id}`).addClass('participant-dead');
        addMessageToChat("AI","狼人" + wolfNo + "要杀死玩家" + targetNo);
    };
    // 初始化预言家行动
    window.prophet_check = function (prophetNo, targetNo) {
        console.log("prophet_check,"+prophetNo+","+targetNo)
        let targetPlayer = gameState.players.find(player => player.id == targetNo);
        targetPlayer.prophetTarget = prophetNo;
        action.prophetAction.push({
            prophetNo : prophetNo,
            targetNo : targetNo,
            action : "prophet_check",
            targetRole : targetPlayer.role,
            nightPhase : gameState.nightPhase
        });
        addMessageToChat("AI","预言家" + prophetNo + "要检查玩家" + targetNo + "的身份,而它的身份是："+targetPlayer.role);
    };
    // 女巫阶段
    window.witch_action = function (witchNo, targetNo, poison) {
        console.log("witch_action,"+witchNo+","+targetNo+","+poison)
        let witchPlayer = gameState.players.find(player => player.id == witchNo);
        let targetPlayer = gameState.players.find(player => player.id == targetNo);
        targetPlayer.witchTarget = witchNo;
        if(poison === "poison"){
            action.witchAction.push({
                witchNo : witchNo,
                targetNo : targetNo,
                action : "witch_action",
                poison : true,
                nightPhase : gameState.nightPhase
            });
            witchPlayer.witchPoison = false;
            targetPlayer.isAlive = false;
            $(`.participant-${player.id}`).addClass('participant-dead participant-posion-out');
            addMessageToChat("AI","女巫" + witchNo + "对玩家" + targetNo + "使用了毒药！");
        }else if(poison === "antidote"){
            action.witchAction.push({
                witchNo : witchNo,
                targetNo : targetNo,
                action : "witch_action",
                antidote : true,
                nightPhase : gameState.nightPhase
            });
            witchPlayer.witchAntidote = false;
            targetPlayer.isAlive = true;
            $(`.participant-${player.id}`).removeClass('participant-dead');
            addMessageToChat("AI","女巫" + witchNo + "对玩家" + targetNo + "使用了解药！");
        }else{
            addMessageToChat("AI","女巫" + witchNo + "对玩家" + targetNo + "使用了未知药品："+poison);
        }
    }
    // 猎人阶段
    window.hunter_shoot = function (hunterNo, targetNo) {
        console.log("hunter_shoot,"+hunterNo+","+targetNo)
        let targetPlayer = gameState.players.find(player => player.id == targetNo);
        targetPlayer.hunterTarget = hunterNo;
        action.hunterAction.push({
            hunterNo: hunterNo,
            targetNo: targetNo,
            action: "hunter_shoot",
            nightPhase: gameState.nightPhase
        });
        targetPlayer.isAlive = false;
        $(`.participant-${player.id}`).addClass('participant-dead participant-hunter-out');
        addMessageToChat("AI", "猎人" + hunterNo + "射击了玩家" + targetNo);
    };

    // 投票阶段
    window.vote = function (voterNo, targetNo) {
        console.log("vote,"+voterNo+","+targetNo)
        let targetPlayer = gameState.players.find(player => player.id == targetNo);
        targetPlayer.voteTarget = voterNo;
        targetPlayer.hasVoted = true;
        action.voteAction.push({
            voterNo: voterNo,
            targetNo: targetNo,
            action: "vote",
            nightPhase: gameState.nightPhase
        });
        addMessageToChat("AI", "玩家" + voterNo + "选择投票给玩家" + targetNo);
    }
}


// 根据玩家身份生成游戏参与者
function generatePlayerParticipants() {
    const playerWrapper = document.getElementById('player-wrapper');
    if (!playerWrapper) return;
    
    // 清空容器
    playerWrapper.innerHTML = '';
    
    // 为每个玩家生成游戏参与者元素
    gameState.players.forEach((player, index) => {
        const participantDiv = document.createElement('div');
        participantDiv.classList.add('player-participant');
        participantDiv.classList.add(`participant-${player.id}`);
    
        // 设置参与者内容
        participantDiv.innerHTML = `
            <div class="participant-actions">
                <button class="btn-mute"></button>
                <button class="btn-camera"></button>
            </div>
            <a class="name-tag" href="#">玩家${player.id} - ${player.role}</a>
            <img alt="${player.name}" src="${getImageForRole(player.role)}">
        `;

        playerWrapper.appendChild(participantDiv);
    });
}

// 根据角色获取对应的头像图片
function getImageForRole(role) {
    // 为不同角色分配不同的头像图片
    switch(role) {
        case ROLES.WEREWOLF:
            return 'img/npc_dota_hero_lycan.gif';
        case ROLES.SEER:
            return 'img/npc_dota_hero_oracle.gif'
        case ROLES.HUNTER:
            return 'img/npc_dota_hero_sniper.gif';
        case ROLES.WITCH:
            return 'img/npc_dota_hero_lina.gif';
        case ROLES.VILLAGER:
            return 'img/npc_dota_hero_dragon_knight_persona_sx.gif';
        default:
            return 'img/npc_dota_hero_dragon_knight_persona_sx.gif';
    }
}

// 开始夜晚阶段
function startNightPhase() {
    gameState.isNight = true;
    gameState.currentPhase = 'night';
    gameState.nightAction = 'werewolf_kill';
    gameState.nightPhase ++ ;
    gameState.players.forEach(player => {
        player.hasVoted = false;
        player.voteCount = 0;
        player.voteTarget = null;
        player.isEnded = false;
        player.wolfTarget = null;
        player.currentPlayer = false;
    });
    // 启动游戏阶段流程
    startGameProcess();
}

// 启动游戏流程
function startGameProcess() {
    // 使用async/await实现优雅的顺序执行
    (async function gameLoop() {
        // 顺序执行各个游戏阶段
        await delay(1000);
        await werewolfKillPhase();
    })();
}

// 延迟函数，返回Promise
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 狼人杀人阶段
function werewolfKillPhase() {
    gameState.nightAction = 'werewolf_kill';
    // 系统发送消息：天黑请闭眼
    addSystemMessage('天黑请闭眼，狼人请睁眼，请问您要杀死的玩家是谁？');
    // 触发暗黑模式
    toggleDarkMode(true);
    
    let content = "当前第"+gameState.nightPhase+"个黑夜，你是狼人，你必须要使用提示词的工具wolf_kill杀死一名玩家，还不能使用vote工具投票。目前";
    gameState.players.forEach(player => {
        if(player.isAlive){
            content += `玩家${player.id}存活`
            if(player.role === ROLES.WEREWOLF){
                content += `且是狼人`
            }
            content +=",";
        }
    });
    let action_temp = false;
    gameState.players.forEach(player => {
        if(player.isAlive && player.role === ROLES.WEREWOLF){
            action_temp = true;
            let time = setInterval(()=>{
                if(chatState === 0){
                    chatHistory=[];
                    let playerId = player.id;
                    chatHistory.push({
                        "role": "system",
                        "content": getPrompt("lyc", playerId, content)
                    });
                    let lastLycChat = aiChat.find(item=>item.role === ROLES.WEREWOLF)
                    if(aiChat.length && lastLycChat){
                        chatHistory.push({
                            "role": "user",
                            "content": JSON.stringify([
                                {
                                    "type": "text",
                                    "text": "这是你的狼人队友的发言，可以参考一下，你们意见要保持一致，即杀死同一名玩家"
                                },
                                {
                                    "type": "text",
                                    "text": lastLycChat.output
                                }
                            ])
                        });
                    }
                    // 删除role是ROLES.WEREWOLF的aiChat
                    for(let i=aiChat.length-1;i>0;i--){
                        if(aiChat[i].role === ROLES.WEREWOLF){
                            aiChat.splice(i,1);
                        }
                    }

                    gameState.players.forEach(player => {
                        player.currentPlayer = false;
                    });
                    player.currentPlayer = true;

                    sendAIMessage(`你是狼人，是${playerId}号玩家，请选择要杀死的玩家，并说说为什么要杀死他`,player,wolfEndFn);
                    clearInterval(time);
                }
            },2000)
        }
    });
    if(!action_temp){
        seerEndFn();
    }
    return Promise.resolve();
}

// 狼人结束阶段
function wolfEndFn(){
    let variables = [];
    gameState.players.forEach(player => {
        if(player.isAlive && player.role === ROLES.WEREWOLF){
            variables.push(player.isEnded);
        }
    });
    if(variables.every(variable => variable === true)){
        seerCheckPhase();
    }
}

// 预言家查验阶段
function seerCheckPhase() {
    gameState.nightAction = 'seer_check';
    addSystemMessage('预言家查验阶段：预言家正在查验玩家身份。');
    let content = "当前第"+gameState.nightPhase+"个黑夜，你是预言家，你必须要使用提示词的工具prophet_check查看一名玩家身份，还不能使用vote工具投票。目前";
    gameState.players.forEach(player => {
        if(player.isAlive){
            content += `玩家${player.id}存活`
            if(player.role === ROLES.SEER){
                content += `且是预言家`
            }
            content +=",";
        }
    });
    let action_temp = false;
    gameState.players.forEach(player => {
        if(player.isAlive && player.role === ROLES.SEER){
            action_temp = true;
            gameState.players.forEach(player => {
                player.currentPlayer = false;
            });
            player.currentPlayer = true;
            chatHistory=[];
            chatHistory.push({
                "role": "system",
                "content": getPrompt("seer", player.id, content)
            });
            sendAIMessage(`你是预言家，是${player.id}号玩家，请选择要检查的玩家，并说说为什么要检查他`,player,seerEndFn);
        }
    })
    if(!action_temp){
        seerEndFn();
    }
    return Promise.resolve();
}

// 预言家结束阶段
function seerEndFn(){
    let variables = [];
    gameState.players.forEach(player => {
        if(player.isAlive && player.role === ROLES.SEER){
            variables.push(player.isEnded);
        }
    });
    if(variables.every(variable => variable === true)){
        witchActionPhase();
    }
}

// 女巫行动阶段
function witchActionPhase() {
    gameState.nightAction = 'witch_action';
    addSystemMessage('女巫行动阶段：女巫可以选择使用解药或毒药。');
    let content = "当前第"+gameState.nightPhase+"个黑夜，你是女巫，你必须要使用提示词的工具witch_action选择解救或者毒杀一名玩家，当然你也可以不行动，你最好在确定一名玩家是狼人的前提下毒杀他，也最好解救预言家。还不能使用vote工具投票。目前";
    gameState.players.forEach(player => {
        if(player.isAlive){
            content += `玩家${player.id}存活`
            if(player.role === ROLES.WITCH){
                content += `且是女巫`
            }
            content +=",";
        }
    });
    if(action.wolfAction.length){
        let killedPlayers =[];
        action.wolfAction.forEach(item=>{
            if(item.action==='wolf_kill' && item.nightPhase === gameState.nightPhase){
                killedPlayers.push(item.targetNo);
            }
        });
        if(killedPlayers.length){
            let action_temp = false;
            gameState.players.forEach(player => {
                if(player.isAlive && player.role === ROLES.WITCH && player.witchAntidote){
                    gameState.players.forEach(player => {
                        player.currentPlayer = false;
                    });
                    player.currentPlayer = true;
                    chatHistory=[];
                    chatHistory.push({
                        "role": "system",
                        "content": getPrompt("witch", player.id, content)
                    });
                    action_temp=true;
                    addSystemMessage('请选择是否使用解药。');
                    sendAIMessage(`你是女巫，是${player.id}号玩家，玩家${killedPlayers}被狼人选择为击杀对象，请选择要解救的玩家，当然你也可以不解救他们。并说说理由`,player,witchNextActionFn);
                }
            })
            if(!action_temp){
                witchNextActionFn();
            }
        }else{
            witchNextActionFn();
        }
    }else{
        witchNextActionFn();
    }
    return Promise.resolve();
}

function witchNextActionFn(){
    let content = "当前第"+gameState.nightPhase+"个黑夜，你是女巫，你必须要使用提示词的工具witch_action选择解救或者毒杀一名玩家，当然你也可以不行动，你最好在确定一名玩家是狼人的前提下毒杀他，也最好解救预言家。还不能使用vote工具投票。目前";
    gameState.players.forEach(player => {
        if(player.isAlive){
            content += `玩家${player.id}存活`
            if(player.role === ROLES.WITCH){
                content += `且是女巫`
            }
            content +=",";
        }
    });
    let action_temp = false;
    gameState.players.forEach(player => {
        if(player.isAlive && player.role === ROLES.WITCH && player.witchPoison){
            gameState.players.forEach(player => {
                player.currentPlayer = false;
            });
            player.currentPlayer = true;
            chatHistory=[];
            chatHistory.push({
                "role": "system",
                "content": getPrompt("witch", player.id, content)
            });
            if(aiChat.length){
                let content=[];
                content.push({
                    "type": "text",
                    "text": "这是女巫使用解药的发言，可以参考一下"
                })
                // 删除aiChat的那段对话
                let index = 0;
                for(let i=0;i<aiChat.length;i++){
                    if(aiChat[i].role === ROLES.WITCH){
                        index = i;
                        content.push({
                            "type": "text",
                            "text": aiChat[i].output
                        });
                        break;
                    }
                }
                aiChat.splice(index,1);
                if(content.length>1){
                    chatHistory.push({
                        "role": "user",
                        "content": JSON.stringify(content)
                    });
                }
            }
            action_temp=true;
            addSystemMessage('请选择是否使用毒药。');
            sendAIMessage(`你是女巫，是${player.id}号玩家，请选择要毒杀的玩家，你最好毒杀狼人，当然你也可以不毒杀任何人。说说理由`,player,hunterActionPhase);
        }
    })
    if(!action_temp){
        hunterActionPhase();
    }
}

// 猎人行动阶段
function hunterActionPhase() {
    gameState.nightAction = 'hunter_action';
    addSystemMessage('猎人行动阶段：如果猎人死亡，可以选择开枪带走一名玩家。');
    let content = "当前第"+gameState.nightPhase+"个黑夜，你是猎人，你必须要使用提示词的工具hunter_shoot射击一名玩家，当然你也可以不射击，你最好在确定一名玩家是狼人的前提下射击他。还不能使用vote工具投票。目前";
    gameState.players.forEach(player => {
        if(player.isAlive){
            content += `玩家${player.id}存活`
            if(player.role === ROLES.HUNTER){
                content += `且是猎人`
            }
            content +=",";
        }
    });
    let action_temp = false;
    gameState.players.forEach(player => {
        if(!player.isAlive && player.role === ROLES.HUNTER){
            gameState.players.forEach(player => {
                player.currentPlayer = false;
            });
            player.currentPlayer = true;
            chatHistory=[];
            chatHistory.push({
                "role": "system",
                "content": getPrompt("hunter", player.id, content)
            });
            action_temp=true;
            addSystemMessage('请选择是否射击一名玩家。');
            sendAIMessage(`你是猎人，是${player.id}号玩家，请选择要射击的玩家，你最好射击狼人，当然你也可以不射击任何人。说说理由`,player,dayDiscussPhase);
        }
    })
    if(!action_temp){
        dayDiscussPhase();
    }
}

// 天亮玩家发言阶段
function dayDiscussPhase(player) {
    gameState.currentPhase = 'discuss';
    let alivePlayer = gameState.players.filter(player => player.isAlive);
    let content = "天亮了，所有玩家依次发言，讨论昨晚的情况。在第" + gameState.nightPhase + "个黑夜，场上的状态是：";
    action.wolfAction.forEach(item => {
        if ((item.action === 'wolf_kill' || item.action === "hunter_shoot" || item.action === "witch_action")
            && item.nightPhase === gameState.nightPhase) {
            let targetNo = item.targetNo;
            gameState.players.forEach(player => {
                if (player.id == targetNo && !player.isAlive) {
                    content += `玩家${item.targetNo}在昨天晚上死亡`;
                }
            });
        }
    })
    content += `，目前还有${alivePlayer.length}名玩家存活，其中`;
    alivePlayer.forEach(player => {
        content += `玩家${player.id}存活`
        content +=",";
    });
    content+=`请尽可能关注玩家的当前发言，同时兼顾玩家的历史发言;`
    chatHistory=[];
    if (!player) {
        // 天亮了，结束夜晚阶段
        startDayPhase();
        addSystemMessage('玩家发言阶段');
        addSystemMessage(content);
        dayDiscussPhase(alivePlayer[0]);
    }else{
        addSystemMessage(`请${player.id}号玩家发言`);
        let historyDiscuss = [];
        let historyAction = null;
        gameState.players.forEach(player => {
            let playerDiscuss = player.discuss;
            if(playerDiscuss.length){
                for(let j=0;j<playerDiscuss.length;j++){
                    if(j===playerDiscuss.length-1){
                        historyDiscuss.push({
                            "type": "text",
                            "text": `玩家${player.id}的当前发言是${playerDiscuss[j]}`
                        })
                    }else{
                        historyDiscuss.push({
                            "type": "text",
                            "text": `玩家${player.id}的历史发言是${playerDiscuss[j]}`
                        })
                    }
                }
            }
        });
        let discussRole = null;
        if(player.role === ROLES.VILLAGER){
            discussRole = "discuss_villager";
        }else if(player.role === ROLES.WEREWOLF){
            discussRole = "discuss_wolf";
            action.wolfAction.forEach(item=>{
                if(item.action==='wolf_kill' && item.nightPhase === gameState.nightPhase && item.wolfNo == player.id){
                    historyAction = "您昨天晚上的行动是：击杀了玩家"+item.targetNo;
                }
            });
        }else if (player.role === ROLES.SEER){
            discussRole = "discuss_seer";
            action.prophetAction.forEach(item=>{
                if(item.action==='prophet_check' && item.nightPhase === gameState.nightPhase && item.prophetNo == player.id){
                    historyAction = `您昨天晚上的行动是：查看了玩家${item.targetNo}的身份，它的身份是${item.targetRole}`
                }
            });
        }else if (player.role === ROLES.WITCH){
            discussRole = "discuss_witch";
            action.witchAction.forEach(item=>{
                if(item.action==='witch_action' && item.nightPhase === gameState.nightPhase && item.witchNo == player.id){
                    if(item.poison){
                        historyAction = "您昨天晚上的行动是：毒死了玩家"+item.targetNo;
                    }else if(item.antidote){
                        historyAction = "您昨天晚上的行动是：用解药救了玩家"+item.targetNo;
                    }
                }
            });
        }else if(player.role === ROLES.HUNTER){
            discussRole = "discuss_hunter";
        }
        chatHistory.unshift({
            "role":"system",
            "content":getPrompt(discussRole, player.id, content, historyAction ===null?null:historyAction)
        });
        if(historyAction!=null){
            chatHistory.push({
                "role":"user",
                "content":JSON.stringify([
                    {
                        "type": "text",
                        "text": "这是你昨天晚上的行动"
                    },
                    {
                        "type": "text",
                        "text": historyAction
                    }
                ])
            })
        }
        chatHistory.push({
            "role":"user",
            "content":JSON.stringify(historyDiscuss)
        })
        sendAIMessage(`你是${player.role}，是${player.id}号玩家，现在是讨论阶段，请开始讨论，你可以畅所欲言，但尽量隐藏自己的身份`, player, ()=>{
            let nextPlayer = getNextPlayer(player);
            if(nextPlayer){
                dayDiscussPhase(nextPlayer)
            }else{
                votingPhase();
            }
        });
    }
}

// 投票阶段
function votingPhase(player) {
    gameState.currentPhase = 'voting';
    let alivePlayer = gameState.players.filter(player => player.isAlive);
    addSystemMessage('投票阶段：所有玩家投票选出可疑的狼人。');
    chatHistory=[];
    let historyDiscuss = [];
    gameState.players.forEach(player => {
        let playerDiscuss = player.discuss;
        if(playerDiscuss.length){
            for(let j=0;j<playerDiscuss.length;j++){
                if(j===playerDiscuss.length-1){
                    historyDiscuss.push({
                        "type": "text",
                        "text": `玩家${player.id}的当前发言是${playerDiscuss[j]}`
                    })
                }
                // 这里不显示历史发言，因为上下文可能会很多
                // else{
                //     historyDiscuss.push({
                //         "type": "text",
                //         "text": `玩家${player.id}的历史发言是${playerDiscuss[j]}`
                //     })
                // }
            }
        }
    });
    if(player){
        let voteRole = null;
        if(player.role === ROLES.VILLAGER){
            voteRole = "vote_villager";
        }else if(player.role === ROLES.WEREWOLF){
            voteRole = "vote_wolf";
        }else if (player.role === ROLES.SEER){
            voteRole = "vote_seer";
        }else if (player.role === ROLES.WITCH){
            voteRole = "vote_witch";
        }else if(player.role === ROLES.HUNTER){
            voteRole = "vote_hunter";
        }
        chatHistory.unshift({
            "role":"system",
            "content":getPrompt(voteRole, player.id, "你只需要用你的投票工具vote投票就行了，不需要解释或者输出其他内容", null)
        });
        chatHistory.push({
            "role":"user",
            "content":JSON.stringify(historyDiscuss)
        })
        sendAIMessage(`天亮了，请${player.id}号玩家，选择要投给哪名玩家`, player, ()=>{
            let nextPlayer = getNextPlayer(player);
            if(nextPlayer){
                votingPhase(nextPlayer)
            }else{
                let end = checkGameEnd();
                if(!end){
                    // 天黑请闭眼
                    startNightPhase();
                }
            }
        });
    }else{
        votingPhase(alivePlayer[0]);
    }
}

// 开始白天阶段
function startDayPhase() {
    gameState.isNight = false;
    gameState.currentPhase = 'day';

    // 关闭暗黑模式
    toggleDarkMode(false);

    // 宣布夜晚结果（杀死的玩家）
    if (gameState.nightTarget) {
        const deadPlayer = getPlayerById(gameState.nightTarget);
        if (deadPlayer) {
            deadPlayer.isAlive = false;
            $(`.participant-${deadPlayer.id}`).addClass('participant-dead');
            addSystemMessage(`天亮了！昨晚玩家${deadPlayer.id}（${deadPlayer.role}）被杀死了！`);
        }
    }

    // 重置夜晚目标
    gameState.nightTarget = null;
    gameState.nightAction = null;

}

//获取下一个行动玩家
function getNextPlayer(player){
    if(playerTemp.length >1){
        for(let i=0;i<playerTemp.length;i++){
            if(playerTemp[i].id == player.id){
                let nextPlayer = null;
                if(i===playerTemp.length-1){
                    nextPlayer = playerTemp[0];
                }else{
                    nextPlayer = playerTemp[i+1];
                }
                playerTemp.splice(i,1);
                return nextPlayer;
            }
        }
    }else if(playerTemp.length === 1){
        let temp = null;
        if(playerTemp[0].id != player.id){
            temp =  playerTemp[0];
        }
        playerTemp=[];
        return temp;
    } else {
        playerTemp = gameState.players.filter(player => player.isAlive);
        return getNextPlayer(player);
    }
}

// 检查游戏是否结束
function checkGameEnd() {
    checkVoteResult();
    // 获取存活的狼人和好人数量
    const alivePlayers = gameState.players.filter(player => player.isAlive);
    const werewolvesAlive = alivePlayers.filter(player => player.role === ROLES.WEREWOLF).length;
    const nonWerewolvesAlive = alivePlayers.length - werewolvesAlive;
    
    // 游戏结束条件
    if (werewolvesAlive === 0) {
        addSystemMessage('游戏结束！好人阵营获胜！');
        return true;
    } else if (werewolvesAlive >= nonWerewolvesAlive) {
        addSystemMessage('游戏结束！狼人阵营获胜！');
        return true;
    }
    // 游戏继续
    return false;
}

function checkVoteResult(){
    if(action.voteAction.length){
        action.voteAction.forEach(item=>{
            if(item.action === "vote" && item.nightPhase === gameState.nightPhase){
                let targetNo = item.targetNo;
                let target = getPlayerById(targetNo);
                if(target){
                    target.voteCount += 1;
                }
            }
        })
        const maxVoteCount = Math.max(...gameState.players.map(player => player.voteCount));
        const votedPlayers = gameState.players.filter(player => player.voteCount === maxVoteCount);
        votedPlayers.forEach(player => {
            player.isAlive = false;
            $(`.participant-${player.id}`).addClass('participant-dead participant-voted-out');
            addSystemMessage(`玩家${player.id}被投票杀死`);
        })
    }
}

// 切换暗黑模式
function toggleDarkMode(enable) {
    const modeSwitch = document.querySelector('.mode-switch');
    if (modeSwitch) {
        // 触发模式切换
        if (enable && !document.body.classList.contains('dark')) {
            modeSwitch.click();
        }
    }
}

// 系统发送消息到对话栏
function addSystemMessage(content) {
    // 检查是否存在addMessageToChat函数（来自chat.js）
    if (typeof addMessageToChat === 'function') {
        addMessageToChat('系统', content);
    } else {
        console.log('系统消息：', content);
        // 如果chat.js还没加载，可以在这里添加临时实现
    }
}

// 打乱数组顺序的辅助函数
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 获取指定玩家信息
function getPlayerById(playerId) {
    return gameState.players.find(player => player.id == playerId);
}

// 获取当前存活的玩家
function getAlivePlayers() {
    return gameState.players.filter(player => player.isAlive);
}

// 导出游戏API
window.werewolfGame = {
    initGame,
    gameStart,
    getPlayerById,
    getAlivePlayers,
    gameState,
    action
};