"use strict";

/**
 * Non-player character add-on.
 * Provides animated moves for NPC with specified behaviour.
 * @module npc_ai
 */
b4w.module["npc_ai"] = function(exports, require) {

var m_vec3 = require("vec3");
var m_quat = require("quat");
var m_anim = require("animation");
var m_ctl  = require("controls");
var m_util = require("util");

var _ev_tracks = [];

var _mat3_tmp    = new Float32Array(9);
var _vec3_tmp    = new Float32Array(3);
var _vec3_tmp_2  = new Float32Array(3);
var _vec3_tmp_3  = new Float32Array(3);
var _vec3_tmp_4  = new Float32Array(3);
var _quat4_tmp   = new Float32Array(4);
var _quat4_tmp_2 = new Float32Array(4);
var _quat4_tmp_3 = new Float32Array(4);

var NT_WALKING  = exports.NT_WALKING  = 10;
var NT_FLYING   = exports.NT_FLYING   = 20;
var NT_SWIMMING = exports.NT_SWIMMING = 30;

var MS_IDLE   = 10;
var MS_MOVING = 20;

/**
 * Creates new event track based on given graph.
 * @param graph Animation graph with a number of movement params.
 * @param graph.path A path wich npc will be moving around.
 * @param graph.delay Time delay before each path step.
 * @param graph.actions Actions for every move type (move, idle, etc).
 * @param graph.obj Animated object.
 * @param graph.collider Object collider for collision detection.
 * @param graph.empty Corresponding empty object.
 * @param graph.speed Movement speed.
 * @param graph.random Determines whether object will perform random moves.
 * @param graph.type Object movement type (walking, flying, etc).
 * @param graph.rot_speed Rotation speed.
 * @method module:npc_ai.npc_ai
 */
exports.new_event_track = function(graph) {

    graph.destination   = new Float32Array(3);
    graph.start         = [];
    graph.ended         = [];
    graph.fired         = [];
    graph.y_correction  = null;
    graph.prev_hit_frac = null;
    graph.y_cor_water   = null;
    graph.xz_correction = null;
    graph.reached       = true;

    if (!graph.random) {
        for (var i = 0; i < graph.path.length; i++) {
            graph.start[i] = -1; // starting time for current move
            graph.ended[i] = false;
            graph.fired[i] = false;
        }
    }

    _ev_tracks.push(graph);
}

/**
 * Calculates destination coordinates and
 * runs anim_translation function
 */
function run_track(elapsed, ev_track) {

    var destination = ev_track.destination;
    var base_pos    = b4w.transform.get_translation(ev_track.empty);

    var current_loc = _vec3_tmp;

    b4w.transform.get_translation(ev_track.collider, current_loc);

    var y_correction = 0;
    if (ev_track.y_cor_water) {
        y_correction = ev_track.y_cor_water;
    } else if (ev_track.y_correction) {
        y_correction = ev_track.y_correction;

        if (ev_track.type == NT_WALKING)
            // prevent walking npc's from "falling undergroung"
            y_correction *= 0.5;

        if (ev_track.type == NT_SWIMMING)
            y_correction *= elapsed;

    }

    switch (ev_track.type) {
    case NT_WALKING:
        if (ev_track.random && ev_track.reached) {
            destination[0] = (Math.random()*12 - 6)*ev_track.speed;
            destination[2] = (Math.random()*12 - 6)*ev_track.speed;
            move_destination_if_too_close(ev_track, destination, current_loc);
            ev_track.reached = false;
        }

        destination[1]  = current_loc[1];

        if (y_correction)
            destination[1] += y_correction;

        break;
    case NT_FLYING:
    case NT_SWIMMING:

        if (ev_track.random && ev_track.reached) {

            if (ev_track.type == NT_SWIMMING) {
                ev_track.speed = Math.random() + 0.1;
                var magnitude = ev_track.max_depth - ev_track.min_depth;
            } else
                var magnitude = ev_track.max_height - ev_track.min_height;

            var rot_speed = ev_track.rot_speed;

            destination[0] = Math.random() * 10 - 5 + base_pos[0];
            destination[1] = current_loc[1] + (Math.random() * magnitude - 0.5 * magnitude);
            destination[2] = Math.random() * 10 - 5 + base_pos[2];
            ev_track.reached = false;
        }

        if (y_correction)
            destination[1] = current_loc[1] + y_correction;

        break;
    }
    anim_translation(elapsed, ev_track);
}

function move_destination_if_too_close(ev_track, dest, cur_loc) {

    var cur_rot_q   = _quat4_tmp_2;
    var cur_hor_dir     = _vec3_tmp_2;
    var hor_dir_to_dest = _vec3_tmp_3;

    var speed = ev_track.speed;
    var rot_speed = ev_track.rot_speed;

    b4w.transform.get_rotation_quat(ev_track.collider, cur_rot_q);
    m_vec3.transformQuat(m_util.AXIS_Z, cur_rot_q, cur_hor_dir);
    cur_hor_dir[1] = 0;
    m_vec3.normalize(cur_hor_dir, cur_hor_dir);

    var sin_half_rot_angle = Math.sin(rot_speed/2); 
    var walk_radius = 0.5 * speed / sin_half_rot_angle;

    var dist = m_vec3.dist(dest, cur_loc);
    if (dist < 2.0 * walk_radius)
        m_vec3.scaleAndAdd(dest, cur_hor_dir, (2.0 * walk_radius - dist), dest);
}

function anim_translation(elapsed, ev_track) {

    var cur_loc     = _vec3_tmp;
    var cur_dir     = _vec3_tmp_2;
    var new_hor_dir = _vec3_tmp_3;
    var new_rot_q   = _quat4_tmp_3;

    var obj        = ev_track.obj;
    var collider   = ev_track.collider;
    var dest       = ev_track.destination;
    var speed      = ev_track.speed;
    var actions    = ev_track.actions;

    var cur_anim   = m_anim.get_current_action(obj);

    // skip iteration if idle animation is playing
    if (m_anim.is_play(obj) && actions.idle
                            && actions.idle.indexOf(cur_anim) != -1)
        return;

    b4w.transform.get_translation(collider, cur_loc);
    var delta_x = dest[0] - cur_loc[0];
    var delta_z = dest[2] - cur_loc[2];
    var left_to_pass = Math.sqrt(delta_x * delta_x + delta_z * delta_z);

    if (left_to_pass > speed * elapsed) {

        ev_track.state = MS_MOVING;

        m_util.xz_direction(dest, cur_loc, new_hor_dir);
        dest_anim_correction(ev_track, dest, left_to_pass, new_hor_dir);

        // rotation
        hor_rot (ev_track, cur_dir, elapsed, new_rot_q, new_hor_dir);
        vert_rot(ev_track, cur_dir, elapsed, new_rot_q);

        b4w.transform.set_rotation_quat_v(collider, new_rot_q);

        // translation
        trans_obj(elapsed, new_rot_q, ev_track, cur_loc, dest);

    } else if (ev_track.type == NT_WALKING) {
        if (!actions.move) {
            ev_track.state = MS_IDLE;
            ev_track.reached = true;
        } else if (cur_anim && actions.move.indexOf(cur_anim) != -1
                            && m_anim.is_play(obj))
            ev_track.state = MS_MOVING;
        else {
            ev_track.state = MS_IDLE;
            ev_track.reached = true;
        }

    } else if (ev_track.type == NT_SWIMMING || ev_track.type == NT_FLYING)
        ev_track.reached = true;

    if (need_proper_animation(ev_track))
        apply_animation(ev_track);
}

function hor_rot(ev_track, cur_dir, elapsed, new_rot_q, new_hor_dir) {

    var cur_rot_q   = _quat4_tmp_2;
    var cur_hor_dir = _vec3_tmp_4;

    b4w.transform.get_rotation_quat(ev_track.collider, cur_rot_q);
    m_vec3.transformQuat(m_util.AXIS_Z, cur_rot_q, cur_dir);

    cur_hor_dir[0]  = cur_dir[0];
    cur_hor_dir[1]  = 0;
    cur_hor_dir[2]  = cur_dir[2];
    m_vec3.normalize(cur_hor_dir, cur_hor_dir);

    var vec_dot = m_vec3.dot(cur_hor_dir, new_hor_dir);

    var angle_to_turn = Math.acos(vec_dot);
    var angle_ratio   = Math.abs(angle_to_turn) / Math.PI;
    var slerp         = elapsed / angle_ratio * ev_track.rot_speed;

    m_quat.rotationTo(cur_hor_dir, new_hor_dir, new_rot_q);
    m_quat.rotationTo(m_util.AXIS_Z, cur_hor_dir, cur_rot_q);

    if (Math.abs(vec_dot) >= 1) {
        m_quat.copy(cur_rot_q, new_rot_q);
        return;
    }

    m_quat.multiply(new_rot_q, cur_rot_q, new_rot_q);
    m_quat.slerp(cur_rot_q, new_rot_q, Math.min(slerp, 1), new_rot_q);
}

function vert_rot(ev_track, cur_dir, elapsed, new_rot_q) {

    if (ev_track.type == NT_FLYING)
        return;

    // synchronization with physics engine
    elapsed = Math.max(elapsed, 1/60);

    var new_vert_q = _quat4_tmp;
    var cur_vert_q = _quat4_tmp_2;

    var cur_vert_angle  = Math.asin(cur_dir[1]);
    m_quat.setAxisAngle(m_util.AXIS_X, -cur_vert_angle, cur_vert_q);

    if (ev_track.y_correction) {
        var delta_hor_dist  = ev_track.speed * elapsed;
        var delta_vert_dist = ev_track.y_correction;
        var new_vert_angle  = Math.atan(delta_vert_dist / delta_hor_dist);
        m_quat.setAxisAngle(m_util.AXIS_X, -new_vert_angle, new_vert_q);
        m_quat.slerp(cur_vert_q, new_vert_q, elapsed, new_vert_q);
        m_quat.multiply(new_rot_q, new_vert_q, new_rot_q);
    } else
        m_quat.multiply(new_rot_q, cur_vert_q, new_rot_q);
}

function trans_obj(elapsed, new_rot_q, ev_track, cur_loc, dest) {

    var new_dir = _vec3_tmp_3;
    var new_loc = _vec3_tmp_4;
    var def_dir = m_util.AXIS_Z;

    m_util.quat_to_dir(new_rot_q, def_dir, new_dir);

    m_vec3.scale(new_dir, ev_track.speed * elapsed, new_loc);
    m_vec3.add(new_loc, cur_loc, new_loc);

    if (ev_track.type != NT_WALKING)
        new_loc[1] = (dest[1] - cur_loc[1]) * elapsed * 0.1 + cur_loc[1];
    else
        new_loc[1] = dest[1];

    b4w.transform.set_translation_v(ev_track.collider, new_loc);
}

/**
 * Attaches sensors to characters and runs elapsed_cb every frame.
 */
exports.enable_animation = function () {

    if(!_ev_tracks.length)
        return;

    create_ray_sensors();

    var elapsed_sensor = m_ctl.create_elapsed_sensor();

    m_ctl.create_sensor_manifold(_ev_tracks[0].collider,
                "ELAPSED", m_ctl.CT_CONTINUOUS, [elapsed_sensor],
                function(s){return s[0]}, elapsed_cb);
}

/**
 * Removes all sensors attached to animated objects and stops animation
 */
exports.disable_animation = function() {
    if(_ev_tracks.length <= 0)
        return;

    for (var i = 0; i < _ev_tracks.length; i++) {
        var ev = _ev_tracks[i];

        if (m_ctl.check_sensor_manifolds(ev.collider))
            m_ctl.remove_sensor_manifolds(ev.collider);

        if (m_anim.is_play(ev.obj))
            m_anim.stop(ev.obj);

    }
}

function elapsed_cb(obj, id, elapsed, pulse) {
    if (pulse == 1) {
        for (var i = 0; i < _ev_tracks.length; i++) {
            process_event_track(_ev_tracks[i], elapsed);
        }
    }
}

function process_event_track(ev_track, elapsed) {

    if (ev_track.random) {
        run_track(elapsed, ev_track);
    } else {
        var focus_time = b4w.global_timeline();
        for (var j = 0; j < ev_track.path.length; j++) {

            if (ev_track.ended[j])
                continue;

            if (!ev_track.fired[j]) {
                ev_track.fired[j] = true;
                ev_track.destination[0] = ev_track.path[j][0];
                ev_track.destination[1] = ev_track.path[j][1];
                ev_track.destination[2] = ev_track.path[j][2];
                ev_track.start[j] = focus_time + ev_track.delay[j];
            }

            if (focus_time < ev_track.start[j])
                break;

            run_track(elapsed, ev_track);
            ev_track.ended[j] = ev_track.reached;
            break;
        }

        if (is_all_ended(ev_track))
            unset_all_fired(ev_track);
    }
}

function unset_all_fired(track) {
    for (var i = 0; i < track.path.length; i++) {
        track.fired[i] = false;
        track.ended[i] = false;
    }
}

function is_all_ended(track) {
    for (var i = 0; i < track.path.length; i++)
        if (track.ended[i] == false)
            return false;
    return true;
}

function ground_cb (obj, id, value, pulse) {

    var ev = event_track_by_obj(obj);

    if (!ev)
        return;

    if (pulse == 1) {

        var hit_pos;

        switch(ev.type) {
            case NT_FLYING:
                hit_pos = 100 * flying_npc_hit_position(obj, id);
                if (hit_pos < ev.min_height) {
                    ev.y_correction = 10;
                } else if (hit_pos > ev.max_height) {
                    ev.y_correction = -10;
                } else
                    ev.y_correction = 0;
            break;
            case NT_WALKING:
                hit_pos = m_ctl.get_sensor_payload(obj, id, 0);
                ev.y_correction = 1 - hit_pos * 100;

                if (ev.prev_hit_frac == ev.y_correction) {
                    ev.prev_hit_frac = ev.y_correction;
                    ev.y_correction = 0;
                } else
                    ev.prev_hit_frac = ev.y_correction;
            break;
            case NT_SWIMMING:
                hit_pos = m_ctl.get_sensor_payload(obj, id, 0);
                if (id == "CLOSE_GROUND") {
                    ev.y_correction = hit_pos * 100 - 1;

                    if (ev.y_correction < 0.1)
                        ev.y_correction = 0.05;
                    else
                        ev.y_correction = 0;

                } else if (id == "CLOSE_WATER") {
                    ev.y_cor_water = hit_pos * 100;

                    if (ev.y_cor_water < ev.min_depth)
                        ev.y_cor_water = -0.02;
                    else if (ev.y_cor_water > ev.max_depth)
                        ev.y_cor_water = 0.02;
                    else
                        ev.y_cor_water = 0;
                }
            break;
        }

    } else
        ev.y_correction = 0;
}

function flying_npc_hit_position(obj, id) {
    for (var i = 0; i < 3; i++) {
        var hit_pos = m_ctl.get_sensor_payload(obj, id, i);
        if (hit_pos)
            return hit_pos;
    }
}

function event_track_by_obj(obj) {

    for (var i = 0; i < _ev_tracks.length; i++) {
        var ev = _ev_tracks[i];

        if (ev.collider == obj) {
            return ev;
        }
    }

    return null;
}

function create_ray_sensors() {
    for (var i = 0; i < _ev_tracks.length; i++) {

        var ev         = _ev_tracks[i];
        var ZERO_POINT = [0, 0, 0];

        switch (ev.type) {
        case NT_FLYING:
            var near_ground_sens = m_ctl.create_ray_sensor(ev.collider,
                    ZERO_POINT, [0, -100, 0], false, "TERRAIN");
            var near_stone_sens = m_ctl.create_ray_sensor(ev.collider,
                    ZERO_POINT, [0, -100 , 0], false, "STONE");
            var near_water_sens = m_ctl.create_ray_sensor(ev.collider,
                    ZERO_POINT, [0, -100 , 0], false, "WATER");

            var ground_sens_arr = [near_ground_sens, near_stone_sens, near_water_sens];

            m_ctl.create_sensor_manifold(ev.collider,
                "CLOSE_GROUND", m_ctl.CT_CONTINUOUS, ground_sens_arr,
                function(s){return s[0] || s[1] || s[2]}, ground_cb);

            break;
        case NT_WALKING:
            var near_ground_sens = m_ctl.create_ray_sensor(ev.collider,
                    [0, 1, 0], [0, -99, 0], false, "TERRAIN");

            var ground_sens_arr = [near_ground_sens];
            m_ctl.create_sensor_manifold(ev.collider,
                "CLOSE_GROUND", m_ctl.CT_CONTINUOUS, ground_sens_arr,
                function(s){return s[0]}, ground_cb);

            break;
        case NT_SWIMMING:
            var near_ground_sens = m_ctl.create_ray_sensor(ev.collider,
                    [0, 1, 0], [0, -99, 0], false, "TERRAIN");
            var near_water_sens = m_ctl.create_ray_sensor(ev.collider,
                    [0, 0, 0], [0, 100, 0], false, "WATER");

            var ground_sens_arr = [near_ground_sens];
            var water_sens_arr  = [near_water_sens];

            m_ctl.create_sensor_manifold(ev.collider,
                "CLOSE_WATER", m_ctl.CT_CONTINUOUS, water_sens_arr,
                function(s){return s[0]}, ground_cb);
            m_ctl.create_sensor_manifold(ev.collider,
                "CLOSE_GROUND", m_ctl.CT_CONTINUOUS, ground_sens_arr,
                function(s){return s[0]}, ground_cb);
            break;
        }

        if (ev.obj && m_anim.get_current_action(ev.obj))
            m_anim.play(ev.obj);
    }
}

function need_proper_animation(ev_track) {

    var obj = ev_track.obj;
    if (!m_anim.is_play(obj)) {
        return true;
    }

    var cur_anim  = m_anim.get_current_action(obj);
    if (!cur_anim)
        return true;

    var actions = ev_track.actions;
    switch (ev_track.state) {
    case MS_IDLE:
        if (!actions.idle)
            return false;

        if (actions.idle.indexOf(cur_anim) == -1)
            return true;

        break;
    case MS_MOVING:
        if (!actions.move)
            return false;

        if (actions.move.indexOf(cur_anim) != -1)
            return false;

        if (actions.move_start && actions.move_start.indexOf(cur_anim) != -1)
            return false;

        if (actions.move_blends && actions.move_blends.indexOf(cur_anim) != -1)
            return false;

        break;
    default:
        return false;
    }

    return true;
}

function apply_animation(ev_track) {

    var obj = ev_track.obj;
    if (m_anim.is_play(obj))
        return;

    var anim_to_play = null;

    switch (ev_track.state) {
    case MS_IDLE:
        anim_to_play = get_idle_animation(ev_track);
        break;
    case MS_MOVING:
        anim_to_play = get_move_animation(ev_track);
        break;
    }

    if (anim_to_play) {
        m_anim.cyclic(obj, false);
        m_anim.set_current_frame_float(obj, 0);
        m_anim.apply(obj, anim_to_play);
        m_anim.play(obj);
    }
}

function get_idle_animation(ev_track) {

    var actions = ev_track.actions;
    if (!actions.idle)
        return null;

    return m_util.random_from_array(actions.idle);
}

function get_move_animation(ev_track) {

    var cur_anim = m_anim.get_current_action(ev_track.obj);
    var actions = ev_track.actions;

    if (need_move_blend_animation(ev_track, cur_anim)) {
        return get_proper_move_blend_animation(ev_track, cur_anim);
    }

    if (need_move_animation(ev_track, cur_anim)) {
        return get_proper_move_animation(ev_track, cur_anim);
    }

    if (need_move_start_animation(ev_track, cur_anim)) {
        return m_util.random_from_array(actions.move_start);
    }

    return null;
}

function need_move_animation(ev_track, cur_anim) {

    var actions = ev_track.actions;
    if (!actions.move)
        return false;

    if (actions.move.indexOf(cur_anim) != -1)
        return true;

    if (!(actions.move_blends || actions.move_start))
        return true;

    if (!actions.move_start && !cur_anim)
        return true;

    if (actions.move_blends && actions.move_blends.indexOf(cur_anim) != -1)
        return true;

    if (actions.move_start && actions.move_start.indexOf(cur_anim) != -1)
        return true;

    return false;
}

function need_move_blend_animation(ev_track, cur_anim) {

    var actions = ev_track.actions;
    if (!actions.move_blends)
        return false;

    if (actions.move_blends.indexOf(cur_anim) != -1)
        return false;

    if (actions.move && actions.move.indexOf(cur_anim) != -1) {
        var identifier = Math.random();
        return identifier > 0.33;
    }

    return false;
}

function need_move_start_animation(ev_track, cur_anim) {

    var actions = ev_track.actions;
    if (!actions.move_start)
        return false;

    if (actions.move_start.indexOf(cur_anim) != -1)
        return false;

    if (actions.move && actions.move.indexOf(cur_anim) == -1)
        return true;

    return false;
}

function get_proper_move_blend_animation(ev_track, cur_anim) {

    var actions = ev_track.actions;
    var ind = actions.move.indexOf(cur_anim);
    return actions.move_blends[ind];
}

function get_proper_move_animation(ev_track, cur_anim) {

    var actions = ev_track.actions;
    if (!actions.move_blends)
        return m_util.random_from_array(actions.move);

    var move_blend_anim_ind = actions.move_blends.indexOf(cur_anim);
    if (move_blend_anim_ind != -1) {
        var ind = move_blend_anim_ind + 1;
        ind = ind < actions.move.length? ind: 0;
        return actions.move[ind];
    }

    if (actions.move.indexOf(cur_anim) != -1)
        return cur_anim;
    else
        return m_util.random_from_array(actions.move);
}

function dest_anim_correction(ev_track, dest, l_to_p, new_dir) {

    var obj          = ev_track.obj;
    if (!obj._anim)
        return

    var speed        = ev_track.speed;
    var left_to_pass = l_to_p;

    var cur_frame         = m_anim.get_current_frame_float(obj);
    var anim_length       = m_anim.get_anim_length(obj);
    var path_per_cycle    = anim_length / 24 * speed;
    var left_to_pass_anim = (1 - cur_frame / anim_length) * path_per_cycle;
    var correlation       = left_to_pass / left_to_pass_anim;

    if (correlation < 0.9) {
        var scale = left_to_pass_anim - left_to_pass;
        m_vec3.scaleAndAdd(dest, new_dir, scale, dest);
    }
}

}

if (window["b4w"])
    window["b4w"]["npc_ai"] = b4w.require("npc_ai");
else
    throw "Failed to register npc_ai, load b4w first";
