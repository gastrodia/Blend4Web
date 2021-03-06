"use strict";

/** 
 * Physics external API.
 * @module physics
 */
b4w.module["physics"] = function(exports, require) {

var m_print   = require("__print");
var physics   = require("__physics");
var util      = require("__util");

/**
 * Character moving type "walk".
 * @const module:physics.CM_WALK
 */
exports["CM_WALK"] = 0;
/**
 * Character moving type "run".
 * @const module:physics.CM_RUN
 */
exports["CM_RUN"] = 1;
/**
 * Character moving type "climb".
 * @const module:physics.CM_CLIMB
 */
exports["CM_CLIMB"] = 2;
/**
 * Character moving type "fly".
 * @const module:physics.CM_FLY
 */
exports["CM_FLY"] = 3;

/**
 * Enable physics simulation.
 * @method module:physics.enable_simulation
 * @param obj Object ID
 */
exports["enable_simulation"] = function(obj) {
    physics.enable_simulation(obj);
}
/**
 * Disable physics simulation.
 * @method module:physics.disable_simulation
 * @param obj Object ID
 */
exports["disable_simulation"] = function(obj) {
    physics.disable_simulation(obj);
}
/**
 * Check if object has simulated physics
 * @method module:physics.has_simulated_physics
 * @param obj Object ID
 */
exports["has_simulated_physics"] = function(obj) {
    return physics.has_simulated_physics(obj);
}
/**
 * Set object gravity.
 * @method module:physics.set_gravity
 * @param obj Object ID
 * @param {Number} gravity Positive object gravity
 */
exports["set_gravity"] = function(obj, gravity) {
    if (!obj._physics) {
        m_print.error("No physics for object " + obj["name"]);
        return;
    }
    physics.set_gravity(obj, gravity);
}
/**
 * Set object linear/angular damping.
 * @method module:physics.set_damping
 * @param obj Object ID
 * @param {Number} damping Linear damping
 * @param {Number} rotation_damping Angular damping
 * settings
 */
exports["set_damping"] = function(obj, damping, rotation_damping) {
    if (!obj._physics) {
        m_print.error("No physics for object " + obj["name"]);
        return;
    }

    var body_id = obj._physics.body_id;
    physics.post_msg("set_damping", body_id, damping, rotation_damping);
}
/**
 * Reset object linear/angular damping to default values.
 * @method module:physics.reset_damping
 * @param obj Object ID
 */
exports["reset_damping"] = function(obj) {
    if (!obj._physics) {
        m_print.error("No physics for object " + obj["name"]);
        return;
    }

    var game = obj["game"];
    var damping = game["damping"];
    var rdamping = game["rotation_damping"];

    var body_id = obj._physics.body_id;
    physics.post_msg("set_damping", body_id, damping, rdamping);
}

/**
 * Set object transform, only for static/kinematic objects
 * @method module:physics.set_transform
 * @param obj Object ID
 * @param trans Translation vector
 * @param quat Rotation quaternion
 */
exports["set_transform"] = function(obj, trans, quat) {
    physics.set_transform.apply(this, arguments);
}

exports["sync_transform"] = function(obj) {
    physics.sync_transform(obj);
}

/**
 * Apply velocity to object (in local space)
 * @method module:physics.apply_velocity
 * @param obj Object ID
 */
exports["apply_velocity"] = function(obj) {
    physics.apply_velocity.apply(this, arguments);
}
/**
 * Apply velocity to object (in world space)
 * @method module:physics.apply_velocity_world
 * @param obj Object ID
 */
exports["apply_velocity_world"] = function(obj) {
    physics.apply_velocity_world.apply(this, arguments);
}
/**
 * Apply force to object (in local space)
 * @method module:physics.apply_force
 * @param obj Object ID
 */
exports["apply_force"] = function(obj, fx_local, fy_local, fz_local, 
        allow_vertical, disable_up) {

    allow_vertical = allow_vertical || false;
    disable_up = disable_up || false;

    physics.apply_force.apply(this, arguments);
}

/**
 * Apply torque to object (in local space)
 * @method module:physics.apply_torque
 * @param obj Object ID
 */
exports["apply_torque"] = function(obj, tx_local, ty_local, tz_local) {
    physics.apply_torque.apply(this, arguments);
}
/**
 * Apply vehicle throttle.
 * @method module:physics.vehicle_throttle
 * @param obj Object ID
 * @param engine_force Engine force (-1..1)
 */
exports["vehicle_throttle"] = function(obj, engine_force) {
    if (!physics.is_vehicle_chassis(obj) && !physics.is_vehicle_hull(obj))
        m_print.error("Wrong object");
    
    physics.vehicle_throttle(obj, util.clamp(engine_force, -1, 1));
}
/**
 * Increment vehicle throttle.
 * @method module:physics.vehicle_throttle_inc
 * @param obj Object ID
 * @param engine_force Engine force increment (0..1)
 * @param dir Throttling direction -1,0,1
 */
exports["vehicle_throttle_inc"] = function(obj, engine_force_inc, dir) {
    if (!physics.is_vehicle_chassis(obj) && !physics.is_vehicle_hull(obj))
        m_print.error("Wrong object");

    engine_force_inc = util.clamp(engine_force_inc, 0, 1);

    var vehicle = obj._vehicle;

    var force = vehicle.engine_force;

    if (dir == -1 || dir == 1) {
        force += dir * engine_force_inc;
        force = Math.max(-1, Math.min(force, 1));
    } else if (dir == 0 && force >= 0) {
        force -= engine_force_inc;
        force = Math.max(0, force);
    } else if (dir == 0 && force < 0) {
        force += engine_force_inc;
        force = Math.min(0, force);
    } else
        m_print.error("Wrong steering direction");

    physics.vehicle_throttle(obj, util.clamp(force, -1, 1));
}
/**
 * Change vehicle steering.
 * @method module:physics.vehicle_steer
 * @param obj Object ID
 * @param steering_value Steering value (-1..1)
 */
exports["vehicle_steer"] = function(obj, steering_value) {
    if (!physics.is_vehicle_chassis(obj) && !physics.is_vehicle_hull(obj))
        m_print.error("Wrong object");

    physics.vehicle_steer(obj, util.clamp(steering_value, -1, 1));
}
/**
 * Increment vehicle steering.
 * @method module:physics.vehicle_steer_inc
 * @param obj Object ID
 * @param steering_value Steering value increment (0..1)
 * @param dir Steering direction -1,0,1
 */
exports["vehicle_steer_inc"] = function(obj, steering_value_inc, dir) {
    if (!physics.is_vehicle_chassis(obj) && !physics.is_vehicle_hull(obj))
        m_print.error("Wrong object");

    steering_value_inc = util.clamp(steering_value_inc, 0, 1);

    var vehicle = obj._vehicle;

    var steering = vehicle.steering;

    if (dir == -1 || dir == 1) {
        steering += dir * steering_value_inc;
        steering = Math.max(-1, Math.min(steering, 1));
    } else if (dir == 0 && steering >= 0) {
        steering -= steering_value_inc;
        steering = Math.max(0, steering);
    } else if (dir == 0 && steering < 0) {
        steering += steering_value_inc;
        steering = Math.min(0, steering);
    } else
        m_print.error("Wrong steering direction");

    physics.vehicle_steer(obj, util.clamp(steering, -1, 1));
}
/**
 * Stop vehicle by applying brake force.
 * @method module:physics.vehicle_brake
 * @param obj Object ID
 * @param brake_force Brake force (0..1)
 */
exports["vehicle_brake"] = function(obj, brake_force) {
    if (!physics.is_vehicle_chassis(obj) && !physics.is_vehicle_hull(obj))
        m_print.error("Wrong object");

    physics.vehicle_brake(obj, util.clamp(brake_force, 0, 1));
}
/**
 * Increment brake force
 * @method module:physics.vehicle_brake_inc
 * @param obj Object ID
 * @param brake_force Brake force increment (-1..1)
 */
exports["vehicle_brake_inc"] = function(obj, brake_force_inc) {
    if (!physics.is_vehicle_chassis(obj) && !physics.is_vehicle_hull(obj))
        m_print.error("Wrong object");

    brake_force_inc = util.clamp(brake_force_inc, -1, 1);

    var vehicle = obj._vehicle;

    var brake_force = vehicle.brake_force;

    brake_force += brake_force * brake_force_inc;
    physics.vehicle_brake(obj, util.clamp(brake_force, 0, 1));
}
/**
 * Check if given object is a vehicle chassis.
 * @method module:physics.is_vehicle_chassis
 * @param obj Object ID
 */
exports["is_vehicle_chassis"] = function(obj) {
    return physics.is_vehicle_chassis(obj);
}
/**
 * Check if given object is a vehicle hull.
 * @method module:physics.is_vehicle_hull
 * @param obj Object ID
 */
exports["is_vehicle_hull"] = function(obj) {
    return physics.is_vehicle_hull(obj);
}
/**
 * Get vehicle name.
 * @method module:physics.get_vehicle_name
 * @param obj Object ID
 */
exports["get_vehicle_name"] = function(obj) {
    if (physics.is_vehicle_chassis(obj) || physics.is_vehicle_hull(obj))
        return obj["b4w_vehicle_settings"]["name"];
    else {
        m_print.error("Wrong object");
        return null;
    }
}
/**
 * Get vehicle throttle value.
 * @method module:physics.get_vehicle_throttle
 * @param obj Object ID
 */
exports["get_vehicle_throttle"] = function(obj) {
    if (physics.is_vehicle_chassis(obj) || physics.is_vehicle_hull(obj))
        return obj._vehicle.engine_force;
    else
        m_print.error("Wrong object");
}
/**
 * Get vehicle steering value.
 * @method module:physics.get_vehicle_steering
 * @param obj Object ID
 */
exports["get_vehicle_steering"] = function(obj) {
    if (physics.is_vehicle_chassis(obj) || physics.is_vehicle_hull(obj))
        return obj._vehicle.steering;
    else
        m_print.error("Wrong object");
}
/**
 * Get vehicle brake force.
 * @method module:physics.get_vehicle_brake
 * @param obj Object ID
 */
exports["get_vehicle_brake"] = function(obj) {
    if (physics.is_vehicle_chassis(obj) || physics.is_vehicle_hull(obj))
        return obj._vehicle.brake_force;
    else
        m_print.error("Wrong object");
}
/**
 * Get vehicle speed in km/h.
 * @method module:physics.get_vehicle_speed
 * @param obj Object ID
 */
exports["get_vehicle_speed"] = function(obj) {
    if (physics.is_vehicle_chassis(obj) || physics.is_vehicle_hull(obj))
        return physics.get_vehicle_speed(obj);
    else
        m_print.error("Wrong object");
}
/**
 * Check if given object is a character.
 * @method module:physics.is_character
 * @param obj Object ID
 */
exports["is_character"] = function(obj) {
    return physics.is_character(obj);
}
/**
 * Move character in corresponding direction.
 * @method module:physics.set_character_move_dir
 * @param obj Object ID
 * @param forw Apply forward speed
 * @param back Apply side speed
 */
exports["set_character_move_dir"] = function (obj, forw, side) {
    physics.set_character_move_dir(obj, forw, side);
}
/**
 * Set character moving type.
 * @method module:physics.set_character_move_type
 * @param obj Object ID
 * @param type Character moving type (0 - walk, 1 - run, 2 - vertical climb)
 */
exports["set_character_move_type"] = function (obj, type) {
    physics.set_character_move_type(obj, type);
}
/**
 * Set character distance to water surface in vertical direction.
 * @method module:physics.set_character_dist_to_water
 * @deprecated
 */
exports["set_character_dist_to_water"] = function (obj, dist) {
    m_print.warn("Function set_character_dist_to_water() is deprecated");
}
/**
 * Set character walk speed.
 * @method module:physics.set_character_walk_velocity
 * @param obj Object ID
 * @param velocity Walking velocity
 */
exports["set_character_walk_velocity"] = function (obj, velocity) {
    physics.set_character_walk_velocity(obj, velocity);
}
/**
 * Set character run speed.
 * @method module:physics.set_character_run_velocity
 * @param obj Object ID
 * @param velocity Running velocity
 */
exports["set_character_run_velocity"] = function (obj, velocity) {
    physics.set_character_run_velocity(obj, velocity);
}
/**
 * Set character fly speed.
 * @method module:physics.set_character_fly_velocity
 * @param obj Object ID
 * @param velocity Flying velocity
 */
exports["set_character_fly_velocity"] = function (obj, velocity) {
    physics.set_character_fly_velocity(obj, velocity);
}
/**
 * Perform character's jump
 * @method module:physics.character_jump
 * @param obj Object ID
 */
exports["character_jump"] = function (obj) {
    physics.character_jump(obj);
}
/**
 * Increment character rotation
 * @method module:physics.character_rotation_inc
 * @param obj Object ID
 * @param h_angle Angle in horizontal plane
 * @param v_angle Angle in vertical plane
 */
exports["character_rotation_inc"] = function (obj, h_angle, v_angle) {
    physics.character_rotation_inc(obj, h_angle, v_angle);
}
/**
 * Set character rotation quaternion
 * @method module:physics.set_character_rotation_quat
 * @param obj Object ID
 * @param quat Rotation quaternion
 */
exports["set_character_rotation_quat"] = function (obj, quat) {
    physics.set_character_rotation_quat(obj, quat);
}
/**
 * Set character rotation in horizontal and vertical planes
 * @method module:physics.set_character_rotation
 * @param obj Object ID
 * @param angle_h Angle in horizontal plane
 * @param angle_v Angle in vertical plane
 */
exports["set_character_rotation"] = function (obj, angle_h, angle_v) {
    physics.set_character_rotation(obj, angle_h, angle_v);
}
/**
 * Set character vertical rotation
 * @method module:physics.set_character_rotation_v
 * @param obj Object ID
 * @param angle Angle in vertical plane
 */
exports["set_character_rotation_v"] = function (obj, angle) {
    physics.set_character_rotation_v(obj, angle);
}
/**
 * Set character horizontal rotation
 * @method module:physics.set_character_rotation_h
 * @param obj Object ID
 * @param angle Angle in horizontal plane
 */
exports["set_character_rotation_h"] = function (obj, angle) {
    physics.set_character_rotation_h(obj, angle);
}
/**
 * Append new async collision test to given object.
 * @method module:physics.append_collision_test
 * @param obj Object ID
 * @param {String} collision_id Collision ID
 * @param callback Collision callback
 */
exports["append_collision_test"] = function(obj, collision_id, callback) {
    physics.append_collision_test(obj, collision_id, callback);
}
/**
 * Remove collision test from given object.
 * @method module:physics.remove_collision_test
 * @param obj Object ID
 * @param {String} collision_id Collision ID
 */
exports["remove_collision_test"] = function(obj, collision_id) {
    physics.remove_collision_test(obj, collision_id);
}
/**
 * Apply new async collision impulse test to given object.
 * @method module:physics.apply_collision_impulse_test
 * @param obj Object ID
 * @param callback Callision impulse test callback
 */
exports["apply_collision_impulse_test"] = function(obj, callback) {
    physics.apply_collision_impulse_test(obj, callback);
}
/**
 * Remove collision impulse test from given object.
 * @method module:physics.clear_collision_impulse_test
 * @param obj Object ID
 */
exports["clear_collision_impulse_test"] = function(obj) {
    physics.clear_collision_impulse_test(obj);
}
/**
 * Append new async ray test to given object.
 * @method module:physics.append_ray_test
 * @param obj Object ID
 * @param {String} collision_id Collision ID
 * @param from From vector
 * @param to To vector
 * @param {Boolean} local_coords From/To specified in local/world space
 * @param callback Ray test callback
 */
exports["append_ray_test"] = function(obj, collision_id, from, to, 
        local_coords, callback) {
    physics.append_ray_test(obj, collision_id, from, to, local_coords, callback);
}
/**
 * Remove ray test from given object.
 * @method module:physics.remove_ray_test
 * @param obj Object ID
 * @param {String} collision_id Collision ID
 * @param from From vector
 * @param to To vector
 * @param {Boolean} local_coords From/To specified in local/world space
 */
exports["remove_ray_test"] = function(obj, collision_id, from, to, 
        local_coords) {
    physics.remove_ray_test(obj, collision_id, from, to, local_coords);
}
/**
 * Apply physics constraint.
 * there is no way to undo applied constraint of this type
 * @method module:physics.apply_constraint
 * @param pivot_type Pivot type
 * @param obj_a Object ID A
 * @param trans_a Translation of pivot frame relative to A
 * @param quat_a Rotation of pivot frame relative to A
 * @param obj_b Object ID B
 * @param trans_b Translation of pivot frame relative to B
 * @param quat_b Rotation of pivot frame relative to B
 * @param limits Object containting constraint limits
 * @param [stiffness=null] 6-dimensional vector with constraint stiffness
 * @param [damping=null] 6-dimensional vector with constraint damping
 */
exports["apply_constraint"] = function(pivot_type, obj_a, trans_a, quat_a,
        obj_b, trans_b, quat_b, limits, stiffness, damping) {

    if (!physics.has_physics(obj_a) || !physics.has_physics(obj_b)) {
        m_print.error("Wrong objects");
        return;
    }

    physics.apply_constraint(pivot_type, obj_a, trans_a, quat_a,
        obj_b, trans_b, quat_b, limits, stiffness, damping);
}
/**
 * Remove physics constraint.
 * constraint identified by object A from apply_constraint function
 * @method module:physics.remove_constraint
 * @param obj_a Object ID A
 */
exports["clear_constraint"] = function(obj_a) {
    if (!physics.has_physics(obj_a) || !physics.has_constraint(obj_a)) {
        m_print.error("Wrong object");
        return;
    }

    physics.clear_constraint(obj_a);
}
/**
 * Pull object A to constraint pivot with object B.
 */
exports["pull_to_constraint_pivot"] = function(obj_a, trans_a, quat_a,
        obj_b, trans_b, quat_b) {

    physics.pull_to_constraint_pivot(obj_a, trans_a, quat_a,
        obj_b, trans_b, quat_b);
}

}
