/* jshint esversion: 11 */
/*jshint -W069 */
//const sizeOf = require('image-size');
//"use strict";
const sizeOf = require('image-size');

const INFO = {
    name: "CustomGetMap",
    intro: "插件CustomMap自定义地图画的辅助插件",
    version: [0, 5, 2],
    other: {
        auth: "Wn1027",

    }
};
ll.registerPlugin(INFO.name, INFO.intro, INFO.version, INFO.other);
// 0.5.2 刷新upload文件夹

let DIR = "./plugins/CustomMap"; // 插件目录
let userCutMap = {}; // 缓存 储存玩家是否正在运行cutMap.exe
let img2binTemp = {};
let yoyorobot = false;
let upload_config;
let uploadAll;

// 配置重载
function reload(){
    if (File.exists(`${DIR}/upload.json`) && File.exists(`./plugins/nodejs/yoyorobot`)){
        yoyorobot = true;
        upload_config = new JsonConfigFile(`${DIR}/upload.json`);
        uploadAll = JSON.parse(upload_config.read());
    }
    // 新建存放.jpg.png.jpeg的目录
    File.createDir(`${DIR}/.img/`);
    File.createDir(`${DIR}/tempData/`);
    return true;
}
reload();

//###########################################################
// 默认配置文件:
let CONFIG_CONF= new JsonConfigFile(`${DIR}/config.json`, JSON.stringify({
    CONFIG: "此为CustomGetMap的配置文件 | by Wn1027",
    onlyOP: false,     // 命令权限 false：所有人可用 | true：仅管理员
    onlyMyMap: true,   // 是否限制玩家仅能获取自己上传的地图画 （Yoyo机器人地图画上传扩展功能）
    tips: true,        // 玩家提示&报错信息开关
    setInterval: 50,   // 地图自动放置时间间隔（单位：ms）
    maxMapNum: 10000,  // 限制单个图片的地图数量, 如果生成的地图太多会阻止获取, 并提示需要缩放裁剪
    python: "python"   // 如果安装cutMap.py, 填写解释器地址(python.exe), 填写"python"则使用全局解释器。
                       // 例如采用venv环境: "./plugins/CustomMap/_cv2/Scripts/python.exe"
}));
//###########################################################

//let MAPUUID_DATA = new JsonConfigFile(`${DIR}/mapuuid.json`); 
let MAPUUID_DATA = new KVDatabase(`${DIR}/MAPUUID`); // 记录图片的mapuuid, 以后删除备用

mc.listen("onServerStarted",function(){
    colorLog("cyan",`CustomGetMap.js ver${INFO.version} 已加载| by Wn1027`);
});


if (CONFIG_CONF.get('onlyOP') == 1){
    var executeOri = PermType.GameMasters;
}else{
    var executeOri = PermType.Any;
}
// 注册命令
var cmd = mc.newCommand("getmap", "§e获取地图画§7 <图片名(带后缀名)> [<裁剪图片:cut> | <删除图片:delete>]", executeOri);
cmd.setEnum("CutAction", ["cut"]);
cmd.setEnum("otherAction", ["all", "delete"]);

//res.参数名
cmd.mandatory("action", ParamType.Enum, "otherAction", 1);
cmd.mandatory("action", ParamType.Enum, "CutAction", 1);
cmd.mandatory("fileName", ParamType.String);

//命令参数组合，三种命令
cmd.overload([]);
cmd.overload(["fileName"]);
cmd.overload(["fileName", "otherAction"]);
cmd.overload(["fileName", "CutAction"]);
cmd.setCallback(cmdCallback);
function cmdCallback(_cmd, _ori, out, res){
    var pl = _ori.player;
    // if (res.reload == 'reload'){
    //     if (!(pl == null || pl.isOP() == true)){
    //         out.error('此命令仅管理员可执行');
    //         return;
    //     }
    //     if (reload()){
    //         return out.succes('CustomGetMap配置重载成功');
    //     }else{
    //         return out.error('CustomGetMap配置重载失败');
    //     }
    // }

    // 检查管理员
    if (CONFIG_CONF.get('onlyOP') == 1){
        if(pl.isOP() == false){
            return out.error(`[CustomGetMap] 此命令只能由管理员执行`);
        }
    }

    upload_config.reload();
    uploadAll = JSON.parse(upload_config.read());

    // 主菜单
    if (res.fileName == undefined){
        // 检查执行主体
        if (pl == null){
            return out.error(`[CustomGetMap] 该命令只能由玩家执行`);
        }

        mainForm(pl);
        return out.success("");
    }

    // 图片名
    let imgFileName = res.fileName;  // 图片文件名
    let suffix = imgFileName.substring(imgFileName.lastIndexOf(".")); // 后缀名
    let imgname = imgFileName.substring(0, imgFileName.lastIndexOf(".")); //无后缀图片名

    // 检查输入是否为图片名
    if (suffix != ".jpeg" && suffix != ".png" && suffix != ".jpg" ){
        return out.error("[CustomGetMap] 请加后缀名 | 只支持.jpeg .jpg .png的图片格式");
    }

    let result;


    // 删除地图画（可后台执行）(内置检测是否上传过图片)
    if (res.action == 'delete'){
        // 检查执行主体
        if (pl == null){
            result = deleteMap(true, 'server', imgFileName, imgname);
        }else{
            result = deleteMap(pl.isOP(), pl.realName, imgFileName, imgname);
        }
        if (result.success){
            return out.success(result.output);
        }else{
            return out.error(result.output);
        }
    }


    // 以下命令只能由玩家执行
    if (pl == null){
        return out.error(`[CustomGetMap] 该命令只能由玩家执行`);
    }

    // 如果使用了机器人扩展, 则检查该玩家是否上传过该图片
    if (File.exists(`${DIR}/upload.json`) && (!pl.isOP()) && CONFIG_CONF.get('onlyMyMap') == true){
        if (!confirmUpload(pl, imgname)){
            return out.error(`[CustomGetMap] 你没有上传过 ${imgFileName}`);
        }
    }

    // 压缩裁剪图片
    if (res.action == 'cut'){
        result = cutMap(pl, imgFileName, imgname);
    }

    // 获取地图画
    if (res.action == undefined || res.action == 'all'){
        result = img2bin(pl, imgFileName, imgname, res.action);
    }

    if (result.success){
        return out.success(result.output);
    }else{
        return out.error(result.output);
    }
}
cmd.setup();

//----------------------------------
// 主菜单
function mainForm(pl){
    let imgList;
    if (yoyorobot){
        let plData, plqq;
        for (let key in uploadAll){
            if (uploadAll[key].playerName == pl.realName){
                plData = uploadAll[key];
                plqq = key;
            }
        }
        if (plData == undefined){
            pl.tell(`§c你没有上传过地图画`);
            return;
        }   
        imgList = plData.imgname.map(imgname=> imgname+'.jpg' );
    }else{
        imgList = File.getFilesList(`${DIR}/.img/`).filter((filename, index, arr) => /(.*)(\.jpg)|(\.png)|(\.jpeg)$/i.test(filename));
    }
    
    function setfm_mapList(imgList){
        let imgListStr = '\n';
        for (let i = 0; i < imgList.length; i ++){
            if(File.exists(`${DIR}/.img/${imgList[i]}`)){
                let shapes_ori = sizeOf(`${DIR}/.img/${imgList[i]}`);
                imgListStr += `§小§d#${i+1} | §b${imgList[i]} §7规格: ${Math.ceil(shapes_ori.width/128)} × ${Math.ceil(shapes_ori.height/128)}\n`;
            }else{
                imgListStr += `§小§d#${i+1} | §b${imgList[i]} §c图片已被删除\n`;
            }
        }

        let fm_mapList = mc.newCustomForm()
        .setTitle("§c§l我上传的图片")
        .addLabel(imgListStr)
        .addDropdown('§e选择操作类型', ['获取地图画封装', '裁剪地图画', '获取全部地图画', '删除地图画'])
        .addInput('§a请输入图片序号','',String(imgList.length));
        return fm_mapList;
    }

    pl.sendForm(setfm_mapList(imgList), (pl, args)=>{return mapList_run(pl, args, imgList);});

    function mapList_run(pl, args, imgList){
        if (args == null){return;}
        let imgIndex = args[2];
        let mode = args[1];
        if (imgIndex == ''){return menu_end_run(pl, '§c§l我上传的图片', '§cERROR 不能为空', setfm_mapList(imgList), (pl, args)=>{return mapList_run(pl, args, imgList);});}
        if (!(/(^[1-9]\d*$)/.test(imgIndex))){
            return menu_end_run(pl, '§c§l我上传的图片', '§cERROR 请输入正整数', setfm_mapList(imgList), (pl, args)=>{return mapList_run(pl, args, imgList);});
        }
        imgIndex = Number(imgIndex);
        if (imgIndex > imgList.length){
            return menu_end_run(pl, '§c§l我上传的图片', '§cERROR 没有此序号对应的图片', setfm_mapList(imgList), (pl, args)=>{return mapList_run(pl, args, imgList);});
        }

        let imgFileName = imgList[imgIndex - 1];
        let imgname = imgFileName.substring(0, imgFileName.lastIndexOf("."));

        if (mode == 0){
            let res = img2bin(pl, imgFileName, imgname, undefined);
            return pl.tell(res.output);
        }

        if (mode == 1){
            let res = cutMap(pl, imgFileName, imgname);
            if (!res.success){
                pl.tell(res.output);
            }
            return;
        }

        if (mode == 2){
            let res = img2bin(pl, imgFileName, imgname, 'all');
            return pl.tell(res.output);
        }

        if (mode == 3){
            pl.sendModalForm(`§c§l删除 ${imgFileName}`, `§c确认删除: ${imgFileName}`, '§c§l确认', '§7§l取消',(pl, confirm)=>{
                if (confirm){
                    let res = deleteMap(pl.isOP(), pl.realName, imgFileName, imgname);
                    return pl.tell(res.output);
                }else{
                    return pl.sendForm(setfm_mapList(imgList), (pl, args)=>{return mapList_run(pl, args, imgList);});
                }
            });
            
        }
    }
    return;
}

// 裁剪地图画
function cutMap(pl, imgFileName, imgname){
    let exeFile;
    if (File.exists(`${DIR}/cutMap.py`)){
        if (CONFIG_CONF.get("python") == "python"){
            exeFile = `python "${DIR}/cutMap.py"`;
        }else{
            exeFile = `"${CONFIG_CONF.get("python")}" ${DIR}/cutMap.py`;
        }      
    }else if (File.exists(`${DIR}/cutMap.exe`)){
        exeFile = `"${DIR}/cutMap.exe"`;
    }else{
        return {success: false, output: `[CustomGetMap] 管理员未启用图片裁剪功能`};
    }

    // 检查.img下图片存在
    if (!(File.exists(`${DIR}/.img/${imgFileName}`))){
        return {success: false, output: `[CustomGetMap] ${DIR}/.img/ 目录下没有名为 <${imgFileName}> 的图片`};
    }

    // 获取尺寸
    let shapes_ori = sizeOf(`${DIR}/.img/${imgFileName}`);
    let shape = [shapes_ori.width, shapes_ori.height];
    let shapes = getFitShapes(Number(shape[0]), Number(shape[1]));
    
    if ((Number(shape[0]) <= 128) || (Number(shape[1]) <= 128)){
        return {success: false, output: `[cutMap] §c该尺寸已经很小: §7(${shape[0]} × ${shape[1]}) §c, 无需处理`};
    }

    let shapeListStr = `\n§a原始尺寸: ${shape[0]} × ${shape[1]}\n`;
    for (let i = 0; i < shapes.length; i++){
        shapeListStr += `§d# ${i+1} | §7${shapes[i][0]*128} × ${shapes[i][1]*128} | ${shapes[i][0]} × ${shapes[i][1]} = ${shapes[i][0]*shapes[i][1]} 张地图\n`;
    }

    let fm_cutMap = mc.newCustomForm()
    .setTitle(`§c§l裁剪图片 ${imgFileName}`)
    .addLabel(shapeListStr)
    .addInput('§a输入序号:');
    pl.sendForm(fm_cutMap, cutMap_run);
    function cutMap_run(pl, args){
        if (args == null){return;}
        let index = args[1];
        if (index == ''){return menu_end_run(pl, `§c§l裁剪图片 ${imgFileName}`, `§cERROR 不能为空`, fm_cutMap, cutMap_run);}
        if (!(/(^[1-9]\d*$)/.test( index ))){
            return menu_end_run(pl, `§c§l裁剪图片 ${imgFileName}`, `§cERROR 请输入正整数`, fm_cutMap, cutMap_run);
        }
        if (index > shapes.length){
            return menu_end_run(pl, `§c§l裁剪图片 ${imgFileName}`, `§cERROR 没有此序号对应的尺寸`, fm_cutMap, cutMap_run);
        }
        index = Number(index);
        let new_width = shapes[index-1][0]*128;
        let new_height = shapes[index-1][1]*128;

        pl.sendModalForm(`§c§l裁剪图片 ${imgFileName}`, `§e确认将 ${imgFileName} 裁剪为: §b${new_width} × ${new_height}`, '§2§l确认', '§7§l取消',(pl, confirm)=>{
            if (confirm){
                let cutcmd = `${exeFile} ${DIR}/.img/${imgFileName} ${new_width} ${new_height}`;
                system.newProcess(cutcmd, function(_exitcode, _output){
                    if (_exitcode == 0){
                        File.delete(`${DIR}/.img/${imgFileName}`); // 删除原图
                        //File.move(`${DIR}/.img/${imgname}`, `${DIR}/.img/Backup/`); // 备份原图
                        File.rename(`${DIR}/.img/r-${imgFileName}`, `${DIR}/.img/${imgFileName}`); // 重命名为原图名字
                        //pl.sendText(`§e已选尺寸: §a${new_width} × ${new_height} | ${new_width/128} × ${new_height/128} = ${new_width/128*new_height/128} 张地图`);
                        
                        let example = ``;
                        if (new_width/128 < 10 && new_height/128 < 10){
                            example = `§7`;
                            for (let i = 0; i < new_height/128; i++){
                                example += '  ';
                                for (let i = 0; i < new_width/128; i++){
                                    example += '❀ ';
                                }
                                example += '\n';
                            }
                            //pl.sendText(example);
                        }

                        //删除旧的二进制文件（新裁剪会覆盖旧裁剪）
                        if ((File.exists(`${DIR}/tempData/${imgname}`))){
                            File.delete(`${DIR}/tempData/${imgname}`);
                        }

                        pl.sendModalForm(`§c§l裁剪完成 ${imgFileName}`, `§e裁剪完成: §b${new_width} × ${new_height}\n\n§6是否获取地图画 ${imgFileName}？\n\n${example}`, '§2§l获取', '§7§l取消',(pl, confirm)=>{
                            if (confirm){
                                img2bin(pl, imgFileName, imgname, undefined);
                            }else{
                                img2bin(pl, imgFileName, imgname, '');
                            }
                        });
                        //pl.sendText(`[CustomGetMap] §b<${imgFileName}> §a裁剪完成 §7| 获取图片: /getmap ${imgFileName}`);
                    }else{
                        pl.sendText(`[cutMap.exe] §c裁剪失败: ${_output}`);
                    }
                },20000);
            }else{
                return pl.sendForm(fm_cutMap, cutMap_run);
            }
        });
    }
        
    return {success: true, output: `[cutMap] §a获取图片尺寸中`};
    
}

// 二进制解析
function img2bin(pl, imgFileName, imgname, mode){
    // 生成二进制文件
    if (img2binTemp[imgname] == true){
        return {success: false, output: `[CustomGetMap] 正在解析 <${imgFileName}>..`};
    }
    let binlist = findbin(imgname);
    if (binlist[0].length != 0){
        let res = getMap(pl, imgFileName, imgname, mode, binlist);
        return {success: res.success, output: res.output};
    }

    // 检查.img下图片存在
    if (!(File.exists(`${DIR}/.img/${imgFileName}`))){
        return {success: false, output: `[CustomGetMap] ${DIR}/.img/ 目录下没有名为 <${imgFileName}> 的图片`};
    }

    //检查img2bin.exe存在
    if (!(File.exists(`${DIR}/img2bin.exe`))){
        return {success: false, output: `[CustomGetMap] \n§c请将 img2bin.exe 放入${DIR}下, \n或将 go-img2bin.exe 改名为 img2bin.exe`};
    }
    
    //检查重复生成
    if (File.exists(`${DIR}/tempData/${imgname})`)){
        File.delete(`${DIR}/tempData/${imgname})`);
        pl.sendText(`[CustomGetMap] §e该文件名已被使用过，生成将覆盖原图片`);
    }

    //调用 img2bin.exe 生成二进制文件
    File.createDir(`${DIR}/tempData/${imgname}/`);
    let batcmd = `"${DIR}/img2bin.exe" -in "${DIR}/.img/${imgFileName}" -out "${DIR}/tempData/${imgname}/${imgname}"`;
    //img2binTemp[imgname] = true;
    system.newProcess(batcmd, function(_exitcode, _output){
        if (_exitcode == 0){
            if(CONFIG_CONF.get('tips') == true){
                var binlist_1 = findbin(imgname);
                pl.sendText(`[CustomGetMap] §a解析图片完成 | §6地图数量 §a${binlist_1[0].length} §6张`);
                let res = getMap(pl, imgFileName, imgname, mode, binlist_1);
                pl.tell(res.output);
                //pl.sendText(`[CustomGetMap] §e空出主手, 再次执行此命令以获取地图画`);
            }
            delete img2binTemp[imgname];
            return;
        }else{
            if(CONFIG_CONF.get('tips') == true){
                pl.sendText(`§c[img2bin.exe] ERROR \n${_output}`);
                pl.sendText(`§c[img2bin.exe] img2bin转换失败`);
            }
            delete img2binTemp[imgname];
            return;                
        }
    },60000);
    return {success: true, output: `[CustomGetMap] 正在解析 <${imgFileName}>..`};
}

// 获取地图画(二进制解析->获取封装或地图)
function getMap(pl, imgFileName, imgname, mode, binlist){
    // 限制地图画数量
    if (binlist[1] * binlist[2] > CONFIG_CONF.get('maxMapNum') && !pl.isOP()){
        return {success: false, output: `[CustomGetMap] 获取失败: §b<${imgFileName}>\n§r规格: ${binlist[1]} × ${binlist[2]} = ${binlist[1] * binlist[2]} 大于 ${CONFIG_CONF.get('maxMapNum')} 张, 请裁切图片。`};
    }

    // 获取地图画封装
    if (mode == undefined){
        generateNewNbt(pl, `§d地图画封装§b(${imgFileName})`, `§e${imgFileName}`, `§7${binlist[1]} × ${binlist[2]}`);
        return {success: true, output: `[CustomGetMap] §a获得地图画封装: §b<${imgFileName}§r§b>\n§r§e规格: §r${binlist[1]} × ${binlist[2]}`};

    }

    // 获取全部地图画
    if (mode == 'all'){
        getAllMap(pl, imgFileName, imgname, binlist); 
        return {success: true, output: `[CustomGetMap] 正在获取全部地图 §b<${imgFileName}> ..`};
    }

    return {success: true, output: ``};
}

// 获取全部地图
async function getAllMap(pl, imgFileName, imgname, binlist){
    let mapuuid_list = MAPUUID_DATA.get(imgname);
    if (mapuuid_list == null){
        MAPUUID_DATA.set(imgname, []);
        mapuuid_list = [];
    }


    let filledmap = mc.newItem("minecraft:filled_map",1);
    let mainhand = pl.getHand();
    if (!mainhand.isNull()){
        mc.spawnItem(mainhand, pl.blockPos);
    }
    mainhand.setNull();
    pl.refreshItems();
    await sleep(50);
    
    let width = binlist[1];
    let height = binlist[2];

    for (let h = 0; h < height; h++){
        for (let w = 0; w < width; w++){
            let mainhand = pl.getHand();
            let newFilledmap = mc.newItem("minecraft:filled_map",1);
            // log(newFilledmap.getNbt().toSNBT(4));
            mainhand.set(newFilledmap);
            pl.refreshItems();
            await sleep(50);

            // CuStomMap核心命令 更换手中的地图
            var cmdResult = mc.runcmdEx(`/execute as "${pl.realName}" at "${pl.realName}" run map "${DIR}/tempData/${imgname}/${imgname}-${w}_${height-1-h}"`);
            if (cmdResult.success == false){
                cmdResult = mc.runcmdEx(`/execute "${pl.realName}" ~~~ map "${DIR}/tempData/${imgname}/${imgname}-${w}_${height-1-h}"`);
                if (cmdResult.success == false){
                    if(CONFIG_CONF.get('tips') == true){
                        pl.sendText("[CustomGetMap] §c/map 命令执行失败\n请检查是否安装 CustomMap.dll 插件");
                    }
                    //clearInterval(taskid);
                    return;
                }
            }

            //记录mapuuid
            let mapuuid = mainhand.getNbt().getTag("tag").getData("map_uuid");
            if (!mapuuid_list.includes(mapuuid)){
                mapuuid_list.push(mapuuid);
            }

            mc.spawnItem(mainhand, pl.blockPos);

            // 清除手中地图
            pl.getHand().setNull(); 
        }
    }
    await sleep(50);
    pl.refreshItems();

    MAPUUID_DATA.set(imgname, mapuuid_list);
    if(CONFIG_CONF.get('tips') == true){
        pl.sendText(`[CustomGetMap] §a成功获取所有地图画 §b<${imgFileName}>`); 
    }
    
    return `成功获取所有地图画 §b<${imgFileName}>`;
}

// 给予地图画封装
function generateNewNbt(pl, name, imgFileName, size) {
    let nbt1 = new NbtCompound({
        "Damage": new NbtInt(0),
        "RepairCost": new NbtInt(1),
        "display": new NbtCompound({
            "Name": new NbtString(name),
            "Lore": new NbtList([
                new NbtString(imgFileName),
                new NbtString(size),
                new NbtString("§7点击展示框释放地图画")
            ])
        }),
        "ench": new NbtList([]),
        // "addon": new NbtCompound({
        //     "type": new NbtString(type),
        //     "lvl": new NbtInt(lvl)
        // })
    });
    let nItem = mc.newItem("minecraft:field_masoned_banner_pattern", 1);
    let nbt = nItem.getNbt();
    nbt.setTag("tag", nbt1);
    nItem.setNbt(nbt);

    let mainhand = pl.getHand();
    if (!mainhand.isNull()){
        mc.spawnItem(mainhand, pl.blockPos);
    }
    mainhand.set(nItem);
    pl.refreshItems();
    return nbt;
}

// 点击展示框
var tmp = {};
mc.listen("onUseItemOn", UseItemOn);
function UseItemOn(pl, it, bl, side, pos){
    let xuid = pl.xuid;
    if (!tmp[xuid]) {
        tmp[xuid] = true;
        setTimeout(function () {
            delete tmp[xuid];
        }, 300);
        if (bl.type != "minecraft:frame" && bl.type != 'minecraft:glow_frame'){return;}
        if (it.type != 'minecraft:field_masoned_banner_pattern'){return;}
        if (it.lore[0].slice(0,2) != '§e'){return;}
        let imgFileName = it.lore[0].slice(2);
        var imgname = imgFileName.substring(0, imgFileName.lastIndexOf(".")); //无后缀图片名

        var binlist = findbin(imgname);
        if (binlist[0].length == 0){
            pl.sendText(`§c图片数据已被删除, 请先执行命令 /getmap ${imgFileName} 生成二进制文件`);
            return false;
        }

        // let width = Number(/§7(\d*)\s×\s(\d*)/.exec(it.lore[1])[1]);
        // let height = Number(/§7(\d*)\s×\s(\d*)/.exec(it.lore[1])[2]);
        //log(`imgFileName: ${imgFileName} | ${width}, ${height}`);

        let width = binlist[1];
        let height = binlist[2];
        let checkFrameResult = checkFrame(pl, bl, side, width, height);

        //展示框不够
        if (checkFrameResult.success == false){
            pl.sendText(checkFrameResult.output);
            return false;
        }

        yieldImg(pl, imgname, binlist, checkFrameResult.minPos, checkFrameResult.next, checkFrameResult.rotation);
        return false;
    }
}

// 在展示框生成图片
async function yieldImg(pl, imgname, binlist, minPos, next, rotation){
    let mapuuid_list = MAPUUID_DATA.get(imgname);
    if (mapuuid_list == null){
        MAPUUID_DATA.set(imgname, []);
        mapuuid_list = [];
    }

    let width = binlist[1];
    let height = binlist[2];
    //let pos = JSON.parse(JSON.stringify(minPos));
    let mainhand = pl.getHand();
    mainhand.setNull(); // 清除封装
    pl.refreshItems();
    //await sleep(CONFIG_CONF.get('setInterval'));
    
    for (let h = 0; h < height; h++){
        for (let w = 0; w < width; w++){
            mainhand = pl.getHand();
            let filledmap = mc.newItem("minecraft:filled_map",1);
            mainhand.set(filledmap);
            pl.refreshItems();
            await sleep(50); 

            // CuStomMap核心命令 更换手中的地图
            var cmdResult = mc.runcmdEx(`/execute as "${pl.realName}" at "${pl.realName}" run map "${DIR}/tempData/${imgname}/${imgname}-${w}_${height-1-h}"`);
            if (cmdResult.success == false){
                cmdResult = mc.runcmdEx(`/execute "${pl.realName}" ~~~ map "${DIR}/tempData/${imgname}/${imgname}-${w}_${height-1-h}"`);
                if (cmdResult.success == false){
                    if(CONFIG_CONF.get('tips') == true){
                        pl.sendText("[CustomGetMap] §c/map 命令执行失败\n请检查是否安装 CustomMap.dll 插件");
                    }
                    return;
                }
            }

            if (!fillFrameImg(pl.getHand(), mc.getBlock(minPos.x, minPos.y, minPos.z, minPos.dimid), rotation)){
                pl.sendText(`§c向展示框放置地图失败(${minPos.x}, ${minPos.y}, ${minPos.z})`);
            }
            await sleep(CONFIG_CONF.get('setInterval')); 
            //log(`放置地图: ${minPos.x}, ${minPos.y}, ${minPos.z}`);

            //记录mapuuid
            let mapuuid = mainhand.getNbt().getTag("tag").getData("map_uuid");
            if (!mapuuid_list.includes(mapuuid)){
                mapuuid_list.push(mapuuid);
            }

            // 清除手中地图
            mainhand.setNull();
            pl.refreshItems();
            next.width(minPos);
        }
        next.width(minPos, -width);
        next.height(minPos);
    }

    MAPUUID_DATA.set(imgname, mapuuid_list);
    if(CONFIG_CONF.get('tips') == true){
        pl.sendText(`[CustomGetMap] §a成功释放地图画 §b<${imgname}>`); 
    }
}

// 删除地图画
function deleteMap(isOP, playerName, imgFileName, imgname){
    if (!(File.exists(`${DIR}/upload.json`) && File.exists(`./plugins/nodejs/yoyorobot`))){
        if (isOP){
            // 删除存档地图数据
            let mapuuid_list = MAPUUID_DATA.get(imgname);
            if (mapuuid_list != null){
                for (let uuid of mapuuid_list){
                    CUSTOMMAP.delMap(uuid);
                }
                MAPUUID_DATA.delete(imgname);
            }

            // 删除图片和缓存
            if (File.exists(`${DIR}/.img/${imgFileName}`) || File.exists(`${DIR}/tempData/${imgname}`)){
                File.delete(`${DIR}/.img/${imgFileName}`);
                File.delete(`${DIR}/tempData/${imgname}`);
                logger.info(`管理员 ${playerName} 删除地图画: ${imgFileName}`);
                return {success: true, output: `已删除地图画: ${imgFileName}`};
            }else{
                return {success: true, output: `图片库中无此图片: ${imgFileName}`};
            }

        }else{
            return {success: false, output: `仅管理员可删除图片`};
        }
    }

    // yoyo机器人
    
    //管理员删除
    if (isOP){
        // 删除存档地图数据
        let mapuuid_list = MAPUUID_DATA.get(imgname);
        if (mapuuid_list != null){
            for (let uuid of mapuuid_list){
                CUSTOMMAP.delMap(uuid);
            }
            MAPUUID_DATA.delete(imgname);
        }

        // 删除图片和缓存
        let uper = '匿名'; 
        for (let key in uploadAll){
            let user_imgs = uploadAll[key];
            if (user_imgs.imgname.includes(imgname)){
                user_imgs.imgname.splice(user_imgs.imgname.indexOf(imgname), 1);
                upload_config.set(key, user_imgs);
                uper = user_imgs.playerName;
            }
        }
        
        if (File.exists(`${DIR}/.img/${imgname}.jpg`) || File.exists(`${DIR}/tempData/${imgname}`)){
            File.delete(`${DIR}/.img/${imgname}.jpg`);
            File.delete(`${DIR}/tempData/${imgname}`);
            logger.info(`管理员 ${playerName} 删除地图画: ${imgFileName}`);
            return {success: true, output: `已删除地图画: ${imgname}.jpg | 上传者: ${uper}`};
        }else{
            if (uper == '匿名'){
                return {success: true, output: `图片库中无此图片: ${imgname}.jpg`};
            }else{
                return {success: true, output: `已删除地图画: ${imgname}.jpg | 上传者: ${uper}`};
            }
        }
    }

    //玩家删除
    let user_imgs;
    let user_id;
    for (let key in uploadAll){
        if (uploadAll[key].playerName == playerName){
            user_imgs = uploadAll[key];
            user_id = key;
            break;
        }
    }
    if (user_imgs == null){
        return {success: false, output: `你没有上传过该图片`};
    }

    if (user_imgs.imgname.includes(imgname)){
        File.delete(`${DIR}/.img/${imgname}.jpg`);
        File.delete(`${DIR}/tempData/${imgname}`);
        let mapuuid_list = MAPUUID_DATA.get(imgname);
        if (mapuuid_list != null){
            for (let uuid of mapuuid_list){
                CUSTOMMAP.delMap(uuid);
            }
            MAPUUID_DATA.delete(imgname);
        }    
        user_imgs.imgname.splice(user_imgs.imgname.indexOf(imgname), 1);
        upload_config.set(user_id, user_imgs);
        logger.info(`${playerName} 删除地图画: ${imgFileName}`);
        return {success: true, output: `已删除地图画: ${imgname}.jpg`};
    }else{
        return {success: false, output: `你没有上传过该图片`};
    }
}


//----------------------------------


// 寻找处理后的二进制文件名 返回文件名列表
function findbin(imgname){
    var regular = /.*-([0-9]*)_([0-9]*)/;
    var mapflname =  File.getFilesList(`${DIR}/tempData/${imgname}/`);
    //log("imgname ",imgname," mapflname ",mapflname);
    var result =[];
    let width= 0, height= 0;
    for (let i=0;i<mapflname.length;i++){
        // if (mapflname[i].indexOf(imgname) != -1){
        if (mapflname[i].indexOf(imgname) != -1 && regular.test(mapflname[i])){
            result.push(mapflname[i]);
            let reRes = regular.exec(mapflname[i]);
            if(Number(reRes[1]) > width)( width = Number(reRes[1]) );
            if(Number(reRes[2]) > height)( height = Number(reRes[2]) );
        }
    }
    width++;
    height++;
    return [result, width, height];
}

// 确认玩家是否上传过该地图画（配合Yoyo机器人扩展）
function confirmUpload(pl, imgname){
    var upload_config = new JsonConfigFile(`${DIR}/upload.json`);
    var upload_data = JSON.parse(upload_config.read());
    for (let key in upload_data){
        if (upload_data[key].playerName == pl.realName){
            for (let i = 0; i< upload_data[key]["imgname"].length; i++){
                if (imgname ==  upload_data[key]["imgname"][i] || imgname ==  "r-"+upload_data[key]["imgname"][i]){
                    return true;
                }
            }
        }
    }
    return false;
}

// 展示框放置地图
function fillFrameImg(it, bl, rotation){
    if (it.type != "minecraft:filled_map"){return false;}
    if (bl.type != "minecraft:frame" && bl.type != 'minecraft:glow_frame'){return false;}
    let blNBT = bl.getNbt();
    let stateNBT = bl.getNbt().getTag("states").setByte("item_frame_map_bit", 1);
    blNBT.setTag("states", stateNBT);
    //log(blNBT.toSNBT(4));
    mc.setBlock(bl.pos, blNBT);

    let be = bl.getBlockEntity();
    let beNbt = be.getNbt();
    beNbt.setTag("Item", it.getNbt());
    beNbt.setTag("ItemRotation", new NbtFloat(rotation));
    // "ItemRotation": 0f,
    // "ItemRotation": 45f,
    // "ItemRotation": 90f,
    // "ItemRotation": 135f,
    // "ItemRotation": 180f,
    // "ItemRotation": 225f,
    // "ItemRotation": 270f,
    // "ItemRotation": 315f,
    
    if (be.setNbt(beNbt)){return true;}
}

function checkFrame(pl, bl, side, width, height){
    let w = 0;
    let h = 0;
    let mapWidth, mapHeight;
    let max = {up: 0, down: 0, right:0, left:0};
    let maxlock = {up: true, down: true, right:true, left:true};
    let radius = Math.max(width, height); //搜寻半径
    //let max = {up: Math.ceil(height/2), down: Math.ceil(-height/2), left: Math.ceil(-width/2), right: Math.ceil(width/2)};
    let r = axisSort(bl.pos, side);
    //log("面: "+r);
    let newPos = r[3];
    let pos_1;

    for (let i =0; i< radius*4; i++){
        if (i % 4 == 0){maxlock.up = false; max.up++;}
        if (i % 4 == 1){maxlock.down = false; max.down--;}
        if (i % 4 == 2){maxlock.right = false; max.right++;}
        if (i % 4 == 3){maxlock.left  = false; max.left--;}

        if (!maxlock.down){
            for (let m = max.left; m <= max.right; m++){
                let n = max.down;
                pos_1 = {[r[0]]: newPos[r[0]]+m, [r[1]]: newPos[r[1]]+n, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                let isframe = isEmptyFrameFunc(pos_1.x, pos_1.y, pos_1.z, pos_1.dimid);
                if(!isframe){
                    max.down++; 
                    //log(`${i}| ${m} ${n} | ${pos_1.x}, ${pos_1.y}, ${pos_1.z} | downlock: ${max.down}`);
                    break;
                }
            }
        }
        
        if (!maxlock.up){
            for (let m = max.left; m <= max.right; m++){
                let n = max.up;
                pos_1 = {[r[0]]: newPos[r[0]]+m, [r[1]]: newPos[r[1]]+n, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                let isframe = isEmptyFrameFunc(pos_1.x, pos_1.y, pos_1.z, pos_1.dimid);
                if(!isframe){
                    max.up--; 
                    //log(`${i}| ${m} ${n} | ${pos_1.x}, ${pos_1.y}, ${pos_1.z} | uplock: ${max.up}`);
                    break;
                }
            }
        }
        
        if (!maxlock.left){
            for (let n = max.down; n <= max.up; n++){
                let m = max.left;
                pos_1 = {[r[0]]: newPos[r[0]]+m, [r[1]]: newPos[r[1]]+n, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                let isframe = isEmptyFrameFunc(pos_1.x, pos_1.y, pos_1.z, pos_1.dimid);
                if(!isframe){
                    max.left++; 
                    //log(`${i}| ${m} ${n} | ${pos_1.x}, ${pos_1.y}, ${pos_1.z} | leftlock: ${max.left}`);
                    break;
                }
            }
        }
        
        if (!maxlock.right){
            for (let n = max.down; n <= max.up; n++){
                let m = max.right;
                pos_1 = {[r[0]]: newPos[r[0]]+m, [r[1]]: newPos[r[1]]+n, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                let isframe = isEmptyFrameFunc(pos_1.x, pos_1.y, pos_1.z, pos_1.dimid);
                if(!isframe){
                    max.right--; 
                    //log(`${i}| ${m} ${n} | ${pos_1.x}, ${pos_1.y}, ${pos_1.z} | rightlock: ${max.right}`);
                    break;
                }
            }
        }
        mapWidth = Math.abs(max.left - max.right ) + 1;
        mapHeight = Math.abs(max.up - max.down ) + 1;
        if (mapWidth >= width && mapHeight >= height){
            break;
        }
        if (maxlock.up && maxlock.down && maxlock.right && maxlock.left){
            break;
        }
        maxlock.up = true;
        maxlock.down = true;
        maxlock.left = true;
        maxlock.right = true;
    }

    //log(`final max R${max.right} U${max.up} L${max.left} D${max.down}`);
    mapWidth = Math.abs(max.left - max.right ) + 1;
    mapHeight = Math.abs(max.up - max.down ) + 1;
    let minPos, next, rotation;
    minPos = {[r[0]]: newPos[r[0]]+max.left, [r[1]]: newPos[r[1]]+max.down, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
    if (side == 0 || side == 1){
        switch (pl.direction.toFacing()){
            case 3: 
                if (side == 1){
                    minPos = {[r[0]]: newPos[r[0]]+max.left, [r[1]]: newPos[r[1]]+max.down, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                    next = {width(pos, value=1){pos.z+=value;}, height(pos, value=1){pos.x+=value;}};
                    rotation = 45;
                }else{
                    minPos = {[r[0]]: newPos[r[0]]+max.left, [r[1]]: newPos[r[1]]+max.up, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                    next = {width(pos, value=1){pos.z+=value;}, height(pos, value=1){pos.x-=value;}};
                    rotation = 135;
                }
                break;
            case 0:
                if (side == 1){
                    minPos = {[r[0]]: newPos[r[0]]+max.left, [r[1]]: newPos[r[1]]+max.up, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                    next = {width(pos, value=1){pos.x-=value;}, height(pos, value=1){pos.z+=value;}};
                    rotation = 90;
                    [mapWidth, mapHeight] = [mapHeight, mapWidth];
                }else{
                    minPos = {[r[0]]: newPos[r[0]]+max.right, [r[1]]: newPos[r[1]]+max.up, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                    next = {width(pos, value=1){pos.x-=value;}, height(pos, value=1){pos.z-=value;}};
                    rotation = 90;
                    [mapWidth, mapHeight] = [mapHeight, mapWidth];
                }
                break;
            case 1:
                if (side == 1){
                    minPos = {[r[0]]: newPos[r[0]]+max.right, [r[1]]: newPos[r[1]]+max.up, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                    next = {width(pos, value=1){pos.z-=value;}, height(pos, value=1){pos.x-=value;}};
                    rotation = 135;
                }else{
                    minPos = {[r[0]]: newPos[r[0]]+max.right, [r[1]]: newPos[r[1]]+max.down, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                    next = {width(pos, value=1){pos.z-=value;}, height(pos, value=1){pos.x+=value;}};
                    rotation = 45;
                }
                break;
            case 2:
                if (side == 1){
                    minPos = {[r[0]]: newPos[r[0]]+max.right, [r[1]]: newPos[r[1]]+max.down, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                    next = {width(pos, value=1){pos.x+=value;}, height(pos, value=1){pos.z-=value;}};
                    rotation = 0;
                    [mapWidth, mapHeight] = [mapHeight, mapWidth];
                }else{
                    minPos = {[r[0]]: newPos[r[0]]+max.left, [r[1]]: newPos[r[1]]+max.down, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                    next = {width(pos, value=1){pos.x+=value;}, height(pos, value=1){pos.z+=value;}};
                    rotation = 0;
                    [mapWidth, mapHeight] = [mapHeight, mapWidth];
                }
                break;
        }
    }else{
        switch (side){
            case 2:
                minPos = {[r[0]]: newPos[r[0]]+max.right, [r[1]]: newPos[r[1]]+max.down, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                next = {width(pos, value=1){pos.x-=value;}, height(pos, value=1){pos.y+=value;}};
                rotation = 0;
                break;
            case 3:
                minPos = {[r[0]]: newPos[r[0]]+max.left, [r[1]]: newPos[r[1]]+max.down, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                next = {width(pos, value=1){pos.x+=value;}, height(pos, value=1){pos.y+=value;}};
                rotation = 0;
                break;
            case 4:
                minPos = {[r[0]]: newPos[r[0]]+max.left, [r[1]]: newPos[r[1]]+max.down, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                next = {width(pos, value=1){pos.z+=value;}, height(pos, value=1){pos.y+=value;}};
                rotation = 0;
                break;
            case 5:
                minPos = {[r[0]]: newPos[r[0]]+max.right, [r[1]]: newPos[r[1]]+max.down, [r[2]]: newPos[r[2]], dimid: newPos.dimid};
                next = {width(pos, value=1){pos.z-=value;}, height(pos, value=1){pos.y+=value;}};
                rotation = 0;
                break;
        }
    }
    //log(`frame: ${mapWidth} * ${mapHeight} | minpos ${minPos.x}, ${minPos.y}, ${minPos.z}`);
    if (mapWidth == 1 && mapHeight == 1){
        if (isEmptyFrameFunc(bl.pos.x, bl.pos.y, bl.pos.z, bl.pos.dimid) == false){
            return {
                success: false,
                output: `§c该位置已有一幅地图画`
            };
        }
    }
    if (mapWidth < width || mapHeight < height){
        return {
            success: false,
            output: `§c该地图画至少需要 ${width} * ${height} 个展示框\n你的框架仅有 ${mapWidth} * ${mapHeight} (宽*高)`
        };
    }else{
        return {
            success: true,
            minPos: minPos,
            next: next,
            rotation: rotation
        };
    }
}

function isEmptyFrameFunc(x, y, z, dimid){
    let bl = mc.getBlock(x, y, z, dimid);
    if ((bl ==null) || (bl.type != 'minecraft:frame' && bl.type != 'minecraft:glow_frame' )){return false;}
    return bl.getBlockEntity().getNbt().getTag("Item") == null;
}

function axisSort(pos, side){
    let result;
    switch (side){
        case 0:
            result = ["z", "x", "y", pos];
            break;
        case 1:
            result = ["z", "x", "y", pos];
            break;
        case 2:
            result = ["x", "y", "z", pos];
            break;
        case 3:
            result = ["x", "y", "z", pos];
            break;
        case 4:
            result = ["z", "y", "x", pos];
            break;
        case 5:
            result = ["z", "y", "x", pos];
            break;
    }
    return result;
}


// 计算裁剪的尺寸
function getFitShapes(w, h){
    let n, m, order;
    if (h < w){
        order = false;
        n = h;
        m = w;
    }else{
        order = true;
        n = w;
        m = h;
    }
    let result = [];
    let n_share = Math.floor(n/128);
    let m_share = Math.floor(m/128);
    let ratio = n / m;

    let n_new, m_new;
    for (let i = 0; i< n_share; i++){
        n_new = n_share - i;
        m_new = Math.floor((n_share - i) /  ratio );
        if (order == true){
            result.push([n_new, m_new]);
        }else{
            result.push([m_new, n_new]);
        }
    }
    return result;
}

// 延迟
async function sleep(time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}

// 结束菜单
function menu_end_run(pl, title, endmsg, lastForm, lastForm_run){
    var menu_end = mc.newSimpleForm();
    menu_end.setTitle(title);
    menu_end.setContent('\n\n'+endmsg+'\n\n\n\n');
    menu_end.addButton('§6§l退出菜单');
    if (lastForm != undefined && lastForm_run != undefined){
        menu_end.addButton('§l返回上一页');
    }
        
    pl.sendForm(menu_end,function(pl,id){
        if (id == null){return;}
        if (id == 1){
            return pl.sendForm(lastForm,lastForm_run);
        }
    });
}