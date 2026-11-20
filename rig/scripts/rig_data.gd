#!/usr/bin/env godot
# Rig data for NPC Linh Nhi, south (front) view only.
# Source: npc-linhnhi.png, frame 221x560, ground pivot (110,558).
# Coordinates are in source-frame pixels. Ground pivot = rig origin (0,0).
# Bone "pos" is relative to parent bone. Sprite "pivot" is the frame
# coordinate that must sit exactly on the bone origin.
# Naming: armL = screen-left arm (her right arm, carries the basket);
# armR = screen-right arm. Basket is a child of armL.
# No blink: the eyes are painted on the face piece, so blinking is
# impossible with this piece set (recorded limitation, not attempted).
class_name RigDataLinhNhi

static func get_data(dir_name: String) -> Dictionary:
	match dir_name:
		"south":
			return _south()
		"n":
			return _dir("n", Vector2(110, 110), Vector2(58, 235), Vector2(168, 235), Vector2(28, 395), "armL", 89, 133, 10, 3)
		"ne":
			return _dir("ne", Vector2(135, 108), Vector2(55, 235), Vector2(170, 235), Vector2(180, 400), "armR", 90, 130, 6, 2)
		"e":
			return _dir("e", Vector2(145, 110), Vector2(98, 235), Vector2(112, 235), Vector2(95, 400), "armL", 102, 135, 10, 3, 1)
		"se":
			return _dir("se", Vector2(108, 110), Vector2(58, 235), Vector2(168, 235), Vector2(30, 395), "armL", 96, 135, 10, 3, 1)
		"sw":
			return _dir("sw", Vector2(92, 110), Vector2(55, 235), Vector2(170, 235), Vector2(195, 408), "armR", 74, 116, 6, 2, 1)
		"w":
			return _dir("w", Vector2(80, 108), Vector2(100, 235), Vector2(115, 235), Vector2(178, 382), "armR", 76, 110, 6, 2, 1)
		"nw":
			return _dir("nw", Vector2(95, 108), Vector2(55, 235), Vector2(170, 235), Vector2(195, 408), "armR", 80, 124, 6, 2, 1)
		_:
			return {}

static func _south() -> Dictionary:
	var frame_size = Vector2(221, 560)
	var ground = Vector2(110, 558)
	var hips_pt = Vector2(110, 470)   # hips / bottom of the dress
	var head_pt = Vector2(110, 110)   # face centre
	var armL_pt = Vector2(55, 235)    # left shoulder (screen-left)
	var armR_pt = Vector2(165, 235)   # right shoulder (screen-right)
	var basket_pt = Vector2(30, 395)  # hand grip on the basket handle
	var legL_pt = Vector2(92, 505)    # top of left leg extension (under dress)
	var legR_pt = Vector2(130, 505)   # top of right leg extension (under dress)
	var hips_rest = hips_pt - ground
	var legL_rest = legL_pt - hips_pt
	var legR_rest = legR_pt - hips_pt
	var head_rest = head_pt - hips_pt
	var armL_rest = armL_pt - hips_pt
	var armR_rest = armR_pt - hips_pt
	var basket_rest = basket_pt - armL_pt
	var bones = {
		"hips": {"parent": "", "pos": hips_rest, "sprite": "", "pivot": hips_pt, "z": 0},
		"torso": {"parent": "hips", "pos": Vector2.ZERO, "sprite": "torso.png", "pivot": hips_pt, "z": 4},
		"head": {"parent": "torso", "pos": head_rest, "sprite": "head.png", "pivot": head_pt, "z": 6},
		"armL": {"parent": "torso", "pos": armL_rest, "sprite": "armL.png", "pivot": armL_pt, "z": 5},
		"armR": {"parent": "torso", "pos": armR_rest, "sprite": "armR.png", "pivot": armR_pt, "z": 5},
		"basket": {"parent": "armL", "pos": basket_rest, "sprite": "basket.png", "pivot": basket_pt, "z": 6},
		"legL": {"parent": "hips", "pos": legL_rest, "sprite": "legL.png", "pivot": legL_pt, "z": 2},
		"legR": {"parent": "hips", "pos": legR_rest, "sprite": "legR.png", "pivot": legR_pt, "z": 3},
	}
	var order = ["hips", "torso", "head", "armL", "armR", "basket", "legL", "legR"]
	# WALK 0.8s loop, 8 frames @10fps. Front view: legs alternate LIFT
	# + hips sway side to side (same pattern as Ha Nhan _south()).
	var walk_tracks = [
		{"path": "Skeleton2D/hips:position", "keys": [
			[0.0, hips_rest + Vector2(0, 0)],
			[0.2, hips_rest + Vector2(2, -2)],
			[0.4, hips_rest + Vector2(0, 0)],
			[0.6, hips_rest + Vector2(-2, -2)],
			[0.8, hips_rest + Vector2(0, 0)]]},
		{"path": "Skeleton2D/hips/legL:position", "keys": [
			[0.0, legL_rest], [0.2, legL_rest + Vector2(2, -10)],
			[0.4, legL_rest], [0.6, legL_rest], [0.8, legL_rest]]},
		{"path": "Skeleton2D/hips/legL:rotation", "keys": [
			[0.0, deg_to_rad(0)], [0.2, deg_to_rad(6)], [0.4, deg_to_rad(0)],
			[0.6, deg_to_rad(0)], [0.8, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/legR:position", "keys": [
			[0.0, legR_rest], [0.2, legR_rest], [0.4, legR_rest],
			[0.6, legR_rest + Vector2(-2, -10)], [0.8, legR_rest]]},
		{"path": "Skeleton2D/hips/legR:rotation", "keys": [
			[0.0, deg_to_rad(0)], [0.2, deg_to_rad(0)], [0.4, deg_to_rad(0)],
			[0.6, deg_to_rad(-6)], [0.8, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/torso/armL:rotation", "keys": [
			[0.0, deg_to_rad(0)], [0.2, deg_to_rad(-3)], [0.4, deg_to_rad(0)],
			[0.6, deg_to_rad(2)], [0.8, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/torso/armR:rotation", "keys": [
			[0.0, deg_to_rad(0)], [0.2, deg_to_rad(3)], [0.4, deg_to_rad(0)],
			[0.6, deg_to_rad(-3)], [0.8, deg_to_rad(0)]]},
		# Basket swings counter-phase to the carrying arm. Arm swing is
		# only +/-3 deg (not +/-6 like Ha Nhan): the basket hangs ~235px
		# below the shoulder pivot, so +/-6 deg would throw it ~21px
		# sideways and clip it out of the 221px frame (seen in round 1:
		# f06 bbox x=7). The basket counter-swings +/-10 deg around its
		# grip pivot (net tilt -/+8 deg, a hanging-basket pendulum) plus
		# a +/-3px position compensation at the extremes so its left
		# edge (x=4 in the source art) never leaves the frame; the
		# handle slides ~3px in the hand at the extreme (sub-pixel at
		# the 118px display size).
		{"path": "Skeleton2D/hips/torso/armL/basket:rotation", "keys": [
			[0.0, deg_to_rad(0)], [0.2, deg_to_rad(10)], [0.4, deg_to_rad(0)],
			[0.6, deg_to_rad(-10)], [0.8, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/torso/armL/basket:position", "keys": [
			[0.0, basket_rest], [0.2, basket_rest + Vector2(-3, 0)],
			[0.4, basket_rest], [0.6, basket_rest + Vector2(3, 0)],
			[0.8, basket_rest]]},
	]
	# IDLE 2.4s loop: slow breathing (hips lift -1px), head nod +/-1px,
	# basket sway +/-2 deg. Arms and legs stay still. (Hips lift is only
	# -1px: the source frame has just ~2.5px headroom above the hair, so
	# -2px would clip the hair tips at the top of the 560px frame.)
	var idle_tracks = [
		{"path": "Skeleton2D/hips:position", "keys": [
			[0.0, hips_rest + Vector2(0, 0)],
			[0.6, hips_rest + Vector2(0, -1)],
			[1.2, hips_rest + Vector2(0, 0)],
			[1.8, hips_rest + Vector2(0, -1)],
			[2.4, hips_rest + Vector2(0, 0)]]},
		# Rest tracks for legs/arms: an AnimationPlayer leaves properties
		# it does NOT track at their previous value, so without these the
		# right shoe stayed ~4px lifted when idle followed walk (caught
		# in the gate: idle-0 shoeR bottom 555 vs source 559).
		{"path": "Skeleton2D/hips/legL:position", "keys": [
			[0.0, legL_rest], [2.4, legL_rest]]},
		{"path": "Skeleton2D/hips/legL:rotation", "keys": [
			[0.0, deg_to_rad(0)], [2.4, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/legR:position", "keys": [
			[0.0, legR_rest], [2.4, legR_rest]]},
		{"path": "Skeleton2D/hips/legR:rotation", "keys": [
			[0.0, deg_to_rad(0)], [2.4, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/torso/armL:rotation", "keys": [
			[0.0, deg_to_rad(0)], [2.4, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/torso/armR:rotation", "keys": [
			[0.0, deg_to_rad(0)], [2.4, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/torso/head:position", "keys": [
			[0.0, head_rest + Vector2(0, 0)],
			[0.6, head_rest + Vector2(0, -1)],
			[1.2, head_rest + Vector2(0, 0)],
			[1.8, head_rest + Vector2(0, 1)],
			[2.4, head_rest + Vector2(0, 0)]]},
		{"path": "Skeleton2D/hips/torso/armL/basket:rotation", "keys": [
			[0.0, deg_to_rad(0)], [0.6, deg_to_rad(2)], [1.2, deg_to_rad(0)],
			[1.8, deg_to_rad(-2)], [2.4, deg_to_rad(0)]]},
	]
	var animations = {
		"walk": {"length": 0.8, "tracks": walk_tracks},
		"idle": {"length": 2.4, "tracks": idle_tracks},
	}
	return {"frame_size": frame_size, "ground": ground, "bones": bones,
		"bone_order": order, "animations": animations}

# Generic 7-direction builder. Same animation definition as _south()
# (WALK 0.8s / 8 frames, IDLE 2.4s / 4 frames, legs lift +10px, hips
# lift-only, rest tracks in idle), parametrised per direction:
# - head_pt / shoulders / basket grip point from the source frame;
# - basket parent = the arm that CARRIES it in that view: armL (screen
#   left) for n/se/e, armR (screen right) for ne/sw/w/nw. In sw/w/nw the
#   carrying arm is the far arm, mostly hidden: its piece is EMPTY (no
#   fabricated pixels) but the bone still exists so the basket can swing.
# - basket_swing: +/-10 deg + +/-3px comp for left-carrier dirs (same as
#   south); only +/-6 deg + +/-2px for right-carrier dirs, because the
#   basket sits at the RIGHT frame edge there (ne x_max 211, nw 213):
#   a full +/-10 deg swing would clip its right edge out of the 221px
#   frame. The carrier-arm rotation itself already moves the grip
#   ~9px, so the visible basket sway stays readable at +/-6 deg.
# - hips_lift: walk hips lift, default 2px like south. All directions
#   except n/ne use 1px: in each, one shoe sits 1px higher than the other
#   in the source art, so at the frame where the higher shoe stands alone,
#   a 2px hips lift put the frame bottom at 556, 1px below the gate.
static func _dir(dir_name: String, head_pt: Vector2, armL_pt: Vector2, armR_pt: Vector2, basket_pt: Vector2, carrier: String, legL_cx: int, legR_cx: int, basket_swing: int, basket_comp: int, hips_lift: int = 2) -> Dictionary:
	var frame_size = Vector2(221, 560)
	var ground = Vector2(110, 558)
	var hips_pt = Vector2(110, 470)
	var legL_pt = Vector2(legL_cx, 505)
	var legR_pt = Vector2(legR_cx, 505)
	var hips_rest = hips_pt - ground
	var legL_rest = legL_pt - hips_pt
	var legR_rest = legR_pt - hips_pt
	var head_rest = head_pt - hips_pt
	var armL_rest = armL_pt - hips_pt
	var armR_rest = armR_pt - hips_pt
	var basket_rest = basket_pt - (armL_pt if carrier == "armL" else armR_pt)
	var bones = {
		"hips": {"parent": "", "pos": hips_rest, "sprite": "", "pivot": hips_pt, "z": 0},
		"torso": {"parent": "hips", "pos": Vector2.ZERO, "sprite": "torso.png", "pivot": hips_pt, "z": 4},
		"head": {"parent": "torso", "pos": head_rest, "sprite": "head.png", "pivot": head_pt, "z": 6},
		"armL": {"parent": "torso", "pos": armL_rest, "sprite": "armL.png", "pivot": armL_pt, "z": 5},
		"armR": {"parent": "torso", "pos": armR_rest, "sprite": "armR.png", "pivot": armR_pt, "z": 5},
		"basket": {"parent": carrier, "pos": basket_rest, "sprite": "basket.png", "pivot": basket_pt, "z": 6},
		"legL": {"parent": "hips", "pos": legL_rest, "sprite": "legL.png", "pivot": legL_pt, "z": 2},
		"legR": {"parent": "hips", "pos": legR_rest, "sprite": "legR.png", "pivot": legR_pt, "z": 3},
	}
	var order = ["hips", "torso", "head", "armL", "armR", "basket", "legL", "legR"]
	# Arm swing phase is tied to the LEGS (legL lifts at 0.2s), so it is
	# IDENTICAL to south in every direction: armL [0,-3,0,+2,0],
	# armR [0,+3,0,-3,0]. Only the basket counter-swing flips sign with
	# its carrier: carrier armL (-3 at 0.2s) -> basket +swing; carrier
	# armR (+3 at 0.2s) -> basket -swing; position comp mirrors the tilt.
	var armL_keys = [[0.0, deg_to_rad(0)], [0.2, deg_to_rad(-3)], [0.4, deg_to_rad(0)], [0.6, deg_to_rad(2)], [0.8, deg_to_rad(0)]]
	var armR_keys = [[0.0, deg_to_rad(0)], [0.2, deg_to_rad(3)], [0.4, deg_to_rad(0)], [0.6, deg_to_rad(-3)], [0.8, deg_to_rad(0)]]
	var bs = 1 if carrier == "armL" else -1
	var basket_path = "Skeleton2D/hips/torso/%s/basket" % carrier
	var walk_tracks = [
		{"path": "Skeleton2D/hips:position", "keys": [
			[0.0, hips_rest + Vector2(0, 0)],
			[0.2, hips_rest + Vector2(2, -hips_lift)],
			[0.4, hips_rest + Vector2(0, 0)],
			[0.6, hips_rest + Vector2(-2, -hips_lift)],
			[0.8, hips_rest + Vector2(0, 0)]]},
		{"path": "Skeleton2D/hips/legL:position", "keys": [
			[0.0, legL_rest], [0.2, legL_rest + Vector2(2, -10)],
			[0.4, legL_rest], [0.6, legL_rest], [0.8, legL_rest]]},
		{"path": "Skeleton2D/hips/legL:rotation", "keys": [
			[0.0, deg_to_rad(0)], [0.2, deg_to_rad(6)], [0.4, deg_to_rad(0)],
			[0.6, deg_to_rad(0)], [0.8, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/legR:position", "keys": [
			[0.0, legR_rest], [0.2, legR_rest], [0.4, legR_rest],
			[0.6, legR_rest + Vector2(-2, -10)], [0.8, legR_rest]]},
		{"path": "Skeleton2D/hips/legR:rotation", "keys": [
			[0.0, deg_to_rad(0)], [0.2, deg_to_rad(0)], [0.4, deg_to_rad(0)],
			[0.6, deg_to_rad(-6)], [0.8, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/torso/armL:rotation", "keys": armL_keys},
		{"path": "Skeleton2D/hips/torso/armR:rotation", "keys": armR_keys},
		{"path": basket_path + ":rotation", "keys": [
			[0.0, deg_to_rad(0)], [0.2, deg_to_rad(basket_swing * bs)], [0.4, deg_to_rad(0)],
			[0.6, deg_to_rad(-basket_swing * bs)], [0.8, deg_to_rad(0)]]},
		{"path": basket_path + ":position", "keys": [
			[0.0, basket_rest], [0.2, basket_rest + Vector2(-basket_comp * bs, 0)],
			[0.4, basket_rest], [0.6, basket_rest + Vector2(basket_comp * bs, 0)],
			[0.8, basket_rest]]},
	]
	var idle_tracks = [
		{"path": "Skeleton2D/hips:position", "keys": [
			[0.0, hips_rest + Vector2(0, 0)],
			[0.6, hips_rest + Vector2(0, -1)],
			[1.2, hips_rest + Vector2(0, 0)],
			[1.8, hips_rest + Vector2(0, -1)],
			[2.4, hips_rest + Vector2(0, 0)]]},
		{"path": "Skeleton2D/hips/legL:position", "keys": [
			[0.0, legL_rest], [2.4, legL_rest]]},
		{"path": "Skeleton2D/hips/legL:rotation", "keys": [
			[0.0, deg_to_rad(0)], [2.4, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/legR:position", "keys": [
			[0.0, legR_rest], [2.4, legR_rest]]},
		{"path": "Skeleton2D/hips/legR:rotation", "keys": [
			[0.0, deg_to_rad(0)], [2.4, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/torso/armL:rotation", "keys": [
			[0.0, deg_to_rad(0)], [2.4, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/torso/armR:rotation", "keys": [
			[0.0, deg_to_rad(0)], [2.4, deg_to_rad(0)]]},
		{"path": "Skeleton2D/hips/torso/head:position", "keys": [
			[0.0, head_rest + Vector2(0, 0)],
			[0.6, head_rest + Vector2(0, -1)],
			[1.2, head_rest + Vector2(0, 0)],
			[1.8, head_rest + Vector2(0, 1)],
			[2.4, head_rest + Vector2(0, 0)]]},
		{"path": basket_path + ":rotation", "keys": [
			[0.0, deg_to_rad(0)], [0.6, deg_to_rad(2)], [1.2, deg_to_rad(0)],
			[1.8, deg_to_rad(-2)], [2.4, deg_to_rad(0)]]},
	]
	var animations = {
		"walk": {"length": 0.8, "tracks": walk_tracks},
		"idle": {"length": 2.4, "tracks": idle_tracks},
	}
	return {"frame_size": frame_size, "ground": ground, "bones": bones,
		"bone_order": order, "animations": animations}
