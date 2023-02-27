@echo off
echo =========================
echo 【在当前目录新建python虚拟环境并安装cv2库】
echo =========================
echo 新建虚拟环境: _cv2 ..
python -m venv _cv2
IF %errorlevel% NEQ 0 GOTO failed
IF %errorlevel% EQU 0 GOTO succeed
pause
:failed	
	echo 新建虚拟环境失败，请检查python是否安装或将python添加到环境变量。
	goto End
:succeed
	echo =========================
	if not exist .\_cv2\Lib\site-packages\cv2 (
		echo 安装cv2库..
		"_cv2/Scripts/pip.exe" install -i https://pypi.tuna.tsinghua.edu.cn/simple opencv-python
	) else (
		echo cv2库已安装
	)
	echo =========================
	echo 安装完毕, 启动cutMap.py, 验证环境是否安装成功。
	echo =========================
	"./_cv2/Scripts/python.exe" cutMap.py
:End
pause