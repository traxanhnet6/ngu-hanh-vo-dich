#!/usr/bin/env godot
# Builds rig_south.tscn for Linh Nhi from cut pieces + bone table + animations.
# Adapted from godotrig scripts/build_rig.gd; extended to add BOTH the
# "walk" and "idle" animations (the original only added "walk").
# Run: godot --headless --path . -s scripts/build_rig.gd -- south
extends SceneTree

const RigData = preload("res://scripts/rig_data.gd")

func _init():
	var args = OS.get_cmdline_user_args()
	var dir_name = "south"
	if args.size() > 0:
		dir_name = args[0]
	var data = RigData.get_data(dir_name)
	if data.is_empty():
		printerr("No rig data for dir: ", dir_name)
		quit(1)
		return
	var root = _build_rig(dir_name, data)
	var packed = PackedScene.new()
	var err = packed.pack(root)
	if err != OK:
		printerr("pack failed: ", err)
		quit(1)
		return
	var out_path = "res://rig_%s.tscn" % dir_name
	err = ResourceSaver.save(packed, out_path)
	if err != OK:
		printerr("save failed: ", err)
		quit(1)
		return
	print("saved ", out_path)
	quit(0)

func _set_owner_recursive(node: Node, owner: Node) -> void:
	for child in node.get_children():
		child.owner = owner
		_set_owner_recursive(child, owner)

func _build_rig(dir_name: String, data: Dictionary) -> Node2D:
	var root = Node2D.new()
	root.name = "RigRoot"
	var skel = Skeleton2D.new()
	skel.name = "Skeleton2D"
	root.add_child(skel)
	var frame_size: Vector2 = data["frame_size"]
	var bones: Dictionary = data["bones"]  # name -> {parent, pos, sprite, pivot, z}
	var bone_nodes := {}
	# Create bones in dependency order (parents first).
	var order: Array = data["bone_order"]
	for bone_name in order:
		var spec: Dictionary = bones[bone_name]
		var bone = Bone2D.new()
		bone.name = bone_name
		bone.position = spec["pos"]
		bone.rest = Transform2D(bone.rotation, bone.position)
		var parent_name: String = spec["parent"]
		if parent_name == "":
			skel.add_child(bone)
		else:
			bone_nodes[parent_name].add_child(bone)
		bone_nodes[bone_name] = bone
		var sprite_file: String = spec.get("sprite", "")
		if sprite_file != "":
			var spr = Sprite2D.new()
			spr.name = "Sprite"
			spr.texture = load("res://pieces/%s/%s" % [dir_name, sprite_file])
			var pivot: Vector2 = spec["pivot"]
			spr.position = Vector2(frame_size.x * 0.5 - pivot.x, frame_size.y * 0.5 - pivot.y)
			spr.z_index = int(spec.get("z", 0))
			spr.z_as_relative = false
			bone.add_child(spr)
	# AnimationPlayer with every animation in data["animations"].
	var player = AnimationPlayer.new()
	player.name = "AnimationPlayer"
	root.add_child(player)
	var lib = AnimationLibrary.new()
	var animations: Dictionary = data["animations"]
	for anim_name in animations:
		var spec: Dictionary = animations[anim_name]
		var anim = Animation.new()
		anim.length = float(spec["length"])
		anim.loop_mode = Animation.LOOP_LINEAR
		anim.step = 0.1
		for track_spec in spec["tracks"]:
			var track = anim.add_track(Animation.TYPE_VALUE)
			anim.track_set_path(track, track_spec["path"])
			anim.track_set_interpolation_type(track, Animation.INTERPOLATION_LINEAR)
			for key in track_spec["keys"]:
				anim.track_insert_key(track, key[0], key[1])
		lib.add_animation(anim_name, anim)
	player.add_animation_library("", lib)
	_set_owner_recursive(root, root)
	return root
