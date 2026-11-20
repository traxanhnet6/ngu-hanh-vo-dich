extends Node2D
# Renders Linh Nhi walk (8 frames @10fps) + idle (4 frames at
# 0/0.6/1.2/1.8s) at 2x supersample via a 520x1140 SubViewport,
# rig scaled 2x. Frame 221x560, ground pivot (110,558) -> rig at
# (260,1128) in 2x coords (viewport has margin around the 442x1120
# sprite so sway/rotation never clips, same idea as godotrig 520x840).
# Saves PNGs to out_2x/south/.
# Downsample with Lanczos afterwards (see scripts/pack_export2x.py):
# 520x1140 -> 260x570, then crop (20,6)-(241,566) to 221x560.
# Run: xvfb-run -a godot --path . --rendering-driver opengl3 res://render2x.tscn

func _ready() -> void:
	var dir_name = "south"
	var args = OS.get_cmdline_user_args()
	if args.size() > 0:
		dir_name = args[0]
	var out_dir = "/home/hatch/workspace/game-ngu-hanh-linhnhi-move/rig/out_2x/" + dir_name
	DirAccess.make_dir_recursive_absolute(out_dir)
	var sv = SubViewport.new()
	sv.size = Vector2i(520, 1140)
	sv.transparent_bg = true
	sv.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(sv)
	var rig = load("res://rig_%s.tscn" % dir_name).instantiate()
	rig.position = Vector2(260, 1128)
	rig.scale = Vector2(2, 2)
	sv.add_child(rig)
	var player: AnimationPlayer = rig.get_node("AnimationPlayer")
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().process_frame
	player.play("walk")
	player.pause()
	for i in range(8):
		player.seek(i * 0.1, true)
		await get_tree().process_frame
		await get_tree().process_frame
		await get_tree().process_frame
		var img = sv.get_texture().get_image()
		var err = img.save_png("%s/f%02d.png" % [out_dir, i])
		print("walk frame ", i, " err=", err, " size=", img.get_size())
	player.play("idle")
	player.pause()
	var idle_times = [0.0, 0.6, 1.2, 1.8]
	for i in range(4):
		player.seek(idle_times[i], true)
		await get_tree().process_frame
		await get_tree().process_frame
		await get_tree().process_frame
		var img = sv.get_texture().get_image()
		var err = img.save_png("%s/g%02d.png" % [out_dir, i])
		print("idle frame ", i, " err=", err, " size=", img.get_size())
	print("render2x done: linhnhi ", dir_name)
	get_tree().quit()
