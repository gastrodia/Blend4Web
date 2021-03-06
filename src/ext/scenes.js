"use strict";

/**
 * Scene API.
 * Almost every routine requires active scene to be set, 
 * use get_active() set_active() to do that.
 * @module scenes
 */
b4w.module["scenes"] = function(exports, require) {

var m_batch  = require("__batch");
var config   = require("__config");
var m_print  = require("__print");
var physics  = require("__physics");
var renderer = require("__renderer");
var m_scenes = require("__scenes");
var util     = require("__util");
var m_cam    = require("__camera");

var cfg_def = config.defaults;

/* subscene types for different aspects of processing */

// need light update
var LIGHT_SUBSCENE_TYPES = ["MAIN_OPAQUE", "MAIN_BLEND", "MAIN_REFLECT",
        "GOD_RAYS", "SKY"];

/**
 * Set active scene
 * @method module:scenes.set_active
 * @param {String} scene_name Name of scene
 */
exports["set_active"] = function(scene_name) {
    // NOTE: keysearch is dangerous
    var scenes = m_scenes.get_all_scenes();
    m_scenes.set_active(util.keysearch("name", scene_name, scenes));
}

/**
 * Get current active scene
 * @method module:scenes.get_active
 * @returns {String} Active scene name
 */
exports["get_active"] = function() {
    if (!m_scenes.check_active())
        return "";
    else
        return m_scenes.get_active()["name"];
}
/**
 * Get all scene names
 * @method module:scenes.get_scenes
 */
exports["get_scenes"] = function() {
    var scenes = m_scenes.get_all_scenes();
    var scene_names = [];
    for (var i = 0; i < scenes.length; i++)
        scene_names.push(scenes[i]["name"]);

    return scene_names;
}
/**
 * Get all screen scene names (ignore used for texture rendering)
 * @method module:scenes.get_screen_scenes
 * @deprecated No scene switching anymore
 */
exports["get_screen_scenes"] = function() {
    m_print.log("get_screen_scenes() deprecated");
    return "";
}
/**
 * Return active camera object from active scene
 * @method module:scenes.get_active_camera
 * @returns Camera object ID
 */
exports["get_active_camera"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    } else
        return m_scenes.get_active()["camera"];
}

/**
 * Get object by name
 * @method module:scenes.get_object_by_name
 * @param name Object name
 * @returns Object ID
 */
exports["get_object_by_name"] = function(name) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }

    var sobjs = m_scenes.get_scene_objs(m_scenes.get_active());
    var sobjs_name = util.keyfind("name", name, sobjs);
    if (sobjs_name.length == 1)
        return sobjs_name[0];
    else {
        m_print.warn("get_object_by_name(" + name + "): not found");
        return false;
    }
}

/**
 * Get object by empty name and origin name.
 * @method module:scenes.get_object_by_empty_name
 * @param empty_name EMPTY object name
 * @param origin_name Origin object name
 * @returns Object ID
 */
exports["get_object_by_empty_name"] = function(empty_name, origin_name) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }

    var sobjs = m_scenes.get_scene_objs(m_scenes.get_active());

    for (var i = 0; i < sobjs.length; i++) {
        var obj = sobjs[i];

        if (obj["dupli_group"] && obj["name"] == empty_name) {
            var dupli_group = obj["dupli_group"];
            var dg_objects = dupli_group["objects"];

            for (var j = 0; j < dg_objects.length; j++) {

                var dg_obj = dg_objects[j];

                if (dg_obj["origin_name"] == origin_name)
                    return dg_obj;
            }
        }
    }

    m_print.warn("get_object_by_empty_name(" + empty_name + ", " + origin_name+ "): not found");
    return null;
}


/**
 * For given mouse coords, render color scene and return object name
 * @method module:scenes.pick_object
 * @param x X screen coordinate
 * @param y Y screen coordinate
 */
exports["pick_object"] = function(x, y) {
    
    if (!m_scenes.check_active()) { 
        m_print.error("No active scene");
        return "";
    }
    var active_scene = m_scenes.get_active();
    var subs_color_pick = m_scenes.get_subs(active_scene, "COLOR_PICKING");

    if (!cfg_def.all_objs_selectable && !subs_color_pick) {
        m_print.error("Color picking disabled by engine configuration");
        return "";
    }
    
    if (subs_color_pick) {
        // NOTE: may be some delay since exports.update() execution
        renderer.draw(subs_color_pick, subs_color_pick.bundles);

        var cam = subs_color_pick.camera;
        var y = cam.height - y;
        var color = renderer.read_pixels(cam.framebuffer, x, y);

        // find objects having the same color
        var sobjs = active_scene._appended_objects["MESH"];
        for (var i = 0; i < sobjs.length; i++) {

            var color_id = sobjs[i]._color_id;
            if (color_id)
                if (Math.abs(255 * color_id[0] - color[0]) < 5.0 &&
                        Math.abs(255 * color_id[1] - color[1]) < 5.0 &&
                        Math.abs(255 * color_id[2] - color[2]) < 5.0) {
                    return sobjs[i]["name"];
                }
        }
    }

    return "";
}

/**
 * Set outline glow intensity for object
 * @method module:scenes.set_glow_intensity
 * @param obj Object ID
 * @param {number} value Intensity value
 */
exports["set_glow_intensity"] = function(obj, value) {
    for (var i = 0; i < obj._batch_slots.length; i++) {
        var slot = obj._batch_slots[i];

        if (slot.batch.type == "COLOR_ID")
            slot.batch.glow_intensity = value;
    }
}

/**
 * Apply glowing animation on object
 * @method module:scenes.apply_glow_anim
 * @param obj Object ID
 * @param {number} tau Glowing duration
 * @param {number} T Period of glowing
 * @param {number} N Number of relapses (0 - infinity)
 */
exports["apply_glow_anim"] = function(obj, tau, T, N) {
    if (obj._render && obj._render.selectable)
        m_scenes.apply_glow_anim(obj, tau, T, N);
}

/**
 * Apply glowing animation with object default settings
 * @method module:scenes.apply_glow_anim_def
 * @param obj Object ID
 */
exports["apply_glow_anim_def"] = function(obj) {
    if (obj._render && obj._render.selectable) {
        var ga = obj._render.glow_anim_settings;
        m_scenes.apply_glow_anim(obj, ga.glow_duration, ga.glow_period, 
                ga.glow_relapses);
    }
}

/**
 * Stop object glowing animation
 * @method module:scenes.clear_glow_anim
 * @param obj Object ID
 */
exports["clear_glow_anim"] = function(obj) {
    if (obj._render && obj._render.selectable)
        m_scenes.clear_glow_anim(obj);
}

/**
 * Set color of glowing
 * @method module:scenes.set_glow_color
 * @param color Color
 */
exports["set_glow_color"] = function(color) {
    var scene = m_scenes.get_active();
    var subs = m_scenes.get_subs(scene, "GLOW");
    if (subs) {
        subs.glow_color = color;
        subs.need_perm_uniforms_update = true;
    }
}

/**
 * @method module:scenes.set_light_pos
 * @deprecated use lights module instead
 */
exports["set_light_pos"] = function() {
    m_print.error("set_light_pos() deprecated, use lights module instead");
}

/**
 * @method module:scenes.set_light_direction
 * @deprecated use lights module instead
 */
exports["set_light_direction"] = function() {
    m_print.error("set_light_direction() deprecated, use lights module instead");
}

/**
 * @method module:scenes.set_dir_light_color
 * @deprecated use lights module instead
 */
exports["set_dir_light_color"] = function(index, val) {
    m_print.error("set_dir_light_color() deprecated, use lights module instead");
}

/**
 * @method module:scenes.get_lights_names
 * @deprecated use lights module instead
 */
exports["get_lights_names"] = function() {
    m_print.error("set_dir_light_color() deprecated, use lights module instead");
}

/**
 * Get shadow_params
 * @method module:scenes.get_shadow_params
 */
exports["get_shadow_params"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }

    var active_scene = m_scenes.get_active();
    var shadow_cast  = m_scenes.get_subs(active_scene, "SHADOW_CAST");

    if (!shadow_cast)
        return null;

    var shadow_params = {};

    var subs = m_scenes.get_subs(active_scene, "BLUR_DEPTH");
    if (subs) {
        shadow_params["blur_depth_size_mult"] = subs.blur_depth_size_mult;
        shadow_params["blur_depth_edge_size"] = subs.blur_depth_edge_size;
        shadow_params["blur_depth_diff_threshold"] = subs.blur_depth_diff_threshold * 1000;
    } 

    var subs = m_scenes.get_subs(active_scene, "DEPTH");
    if (subs) {
        shadow_params["shadow_visibility_falloff"] = subs.shadow_visibility_falloff;
    }

    var shs = active_scene._render.shadow_params;
    shadow_params["csm_near"] = shs.csm_near;
    shadow_params["csm_far"] = shs.csm_far;
    shadow_params["csm_num"] = shs.csm_num;
    shadow_params["csm_lambda"] = shs.csm_lambda;
    shadow_params["csm_borders"] = m_scenes.get_csm_borders(active_scene);

    return shadow_params;
} 

/**
 * Set shadow params
 * @method module:scenes.set_shadow_params
 * @param {object} shadow_params Shadow params
 */
exports["set_shadow_params"] = function(shadow_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }

    var active_scene = m_scenes.get_active();
    var subscenes = m_scenes.subs_array(active_scene, LIGHT_SUBSCENE_TYPES);
    
    var subs = m_scenes.get_subs(active_scene, "DEPTH");
    if (subs) {
        if ("shadow_visibility_falloff" in shadow_params)
            subs.shadow_visibility_falloff = shadow_params["shadow_visibility_falloff"];
    }

    var subscenes = m_scenes.subs_array(active_scene, ["BLUR_DEPTH"]);

    for (var i = 0; i < subscenes.length; i++) {

        var subs = subscenes[i];

        if ("blur_depth_size_mult" in shadow_params) {
            subs.blur_depth_size_mult = shadow_params["blur_depth_size_mult"];

            var bundles = subs.bundles;
            var batch = bundles[0].batch;
            if (batch && batch.texel_size) {
                m_batch.set_texel_size_mult(batch, shadow_params["blur_depth_size_mult"]);
                m_scenes.set_texel_size(subs, 1/subs.camera.width, 1/subs.camera.width);
            }
        }

        if ("blur_depth_edge_size" in shadow_params)
            subs.blur_depth_edge_size = shadow_params["blur_depth_edge_size"];

        if ("blur_depth_diff_threshold" in shadow_params)
            subs.blur_depth_diff_threshold = shadow_params["blur_depth_diff_threshold"] / 1000;

        subs.need_perm_uniforms_update = true;
    } 

    var shs = active_scene._render.shadow_params;

    if ("csm_near" in shadow_params)
        shs.csm_near = shadow_params["csm_near"];

    if ("csm_far" in shadow_params)
        shs.csm_far = shadow_params["csm_far"];
    
    if ("csm_lambda" in shadow_params)
        shs.csm_lambda = shadow_params["csm_lambda"];

    // update directives; only depth subs supported
    var subs = m_scenes.get_subs(active_scene, "DEPTH");
    if (subs) {

        var bundles = subs.bundles;

        for (var i = 0; i < bundles.length; i++) {

            var bundle = bundles[i];

            if (!bundle.obj_render.shadow_receive)
                continue;
                
            var batch = bundle.batch;

            m_batch.assign_shadow_receive_dirs(batch, m_scenes.get_csm_borders(active_scene));

            m_batch.update_shader(batch);
        }
        subs.need_perm_uniforms_update = true;
    }
    m_scenes.schedule_shadow_update(active_scene);
}

/**
 * Get horizon and zenith colors of environment.
 * @method module:scenes.get_environment_colors
 */
exports["get_environment_colors"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    return m_scenes.get_environment_colors(active_scene);
}

/**
 * Set horizon and/or zenith color(s) of environment.
 * @method module:scenes.set_environment_colors
 * @param opt_environment_energy Environment Energy
 * @param opt_horizon_color Horizon color
 * @param opt_zenith_color Zenith color
 */
exports["set_environment_colors"] = function(opt_environment_energy, 
        opt_horizon_color, opt_zenith_color) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.set_environment_colors(active_scene,
            parseFloat(opt_environment_energy), opt_horizon_color,
            opt_zenith_color);
}

/**
 * Get fog color and density.
 * @method module:scenes.get_fog_color_density
 * @param {vec4} dest Destnation vector
 */
exports["get_fog_color_density"] = function(dest) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    return m_scenes.get_fog_color_density(active_scene, dest);
}

/**
 * Set fog color and density
 * @method module:scenes.set_fog_color_density
 * @param {vec4} val 3 color and 1 density
 */
exports["set_fog_color_density"] = function(val) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.set_fog_color_density(active_scene, val);
}

/**
 * Get ssao params
 * @method module:scenes.get_ssao_params
 */
exports["get_ssao_params"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    return m_scenes.get_ssao_params(active_scene);
}

/**
 * Set ssao params
 * @method module:scenes.set_ssao_params
 * @param ssao_params SSAO params
 * @param ssao_params.radius_increase Radius Increase
 * @param ssao_params.depth_min Depth minimum
 */
exports["set_ssao_params"] = function(ssao_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.set_ssao_params(active_scene, ssao_params);
}

/**
 * Get color correction params
 * @method module:scenes.get_color_correction_params
 * @returns {object} Color correction params 
 */
exports["get_color_correction_params"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return null;
    }

    var active_scene = m_scenes.get_active();
    var subs = m_scenes.get_subs(active_scene, "COMPOSITING");
    if (!subs) 
        return null;

    var compos_params = {};

    compos_params["brightness"] = subs.brightness;
    compos_params["contrast"] = subs.contrast;
    compos_params["exposure"] = subs.exposure;
    compos_params["saturation"] = subs.saturation;

    return compos_params;
}

/**
 * Set color correction params
 * @method module:scenes.set_color_correction_params
 * @param {object} Color correction params 
 */
exports["set_color_correction_params"] = function(compos_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return null;
    }

    var active_scene = m_scenes.get_active();
    var subs = m_scenes.get_subs(active_scene, "COMPOSITING");
    if (!subs) 
        return null;

    if ("brightness" in compos_params)
        subs.brightness = compos_params["brightness"];

    if ("contrast" in compos_params)
        subs.contrast = compos_params["contrast"];

    if ("exposure" in compos_params)
        subs.exposure = compos_params["exposure"];

    if ("saturation" in compos_params)
        subs.saturation = compos_params["saturation"];
}

/**
 * Get sky params
 * @method module:scenes.get_sky_params
 */
exports["get_sky_params"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    return m_scenes.get_sky_params(active_scene);
}

/**
 * Set sky params
 * @method module:scenes.set_sky_params
 * @param sky_params sky params
 */
exports["set_sky_params"] = function(sky_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.set_sky_params(active_scene, sky_params);
}
/**
 * Get AA params
 * @method module:scenes.get_aa_params
 */
exports["get_aa_params"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    return m_scenes.get_aa_params(active_scene);
}


/**
 * Set AA params
 * @method module:scenes.set_aa_params
 * @param {object} aa params
 */
exports["set_aa_params"] = function(aa_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.set_aa_params(active_scene, aa_params);
}

/**
 * Get depth of field params.
 * @method module:scenes.get_dof_params
 */
exports["get_dof_params"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    var subs = m_scenes.get_subs(active_scene,"DOF");
    if (subs)
        return m_scenes.get_dof_params(active_scene);
    else 
        return null;
}

/**
 * Set depth of field params
 * @method module:scenes.set_dof_params
 * @param {object} dof params
 */
exports["set_dof_params"] = function(dof_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.set_dof_params(active_scene, dof_params);
}

/**
 * Get god rays parameters
 * @method module:scenes.get_god_rays_params 
 */
exports["get_god_rays_params"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    var subs = m_scenes.get_subs(active_scene,"GOD_RAYS");
    if (subs)
        return m_scenes.get_god_rays_params(active_scene);
    else 
        return null;
}

/**
 * Set god rays parameters
 * @method module:scenes.set_god_rays_params
 * @param {object} god rays params 
 */
exports["set_god_rays_params"] = function(god_rays_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.set_god_rays_params(active_scene, god_rays_params);
}

/**
 * Get bloom parameters
 * @method module:scenes.get_bloom_params 
 */
exports["get_bloom_params"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    var subs = m_scenes.get_subs(active_scene,"BLOOM");
    if (subs)
        return m_scenes.get_bloom_params(active_scene);
    else 
        return null;
}

/**
 * Set bloom parameters
 * @method module:scenes.set_bloom_params
 * @param {object} bloom params 
 */
exports["set_bloom_params"] = function(bloom_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.set_bloom_params(active_scene, bloom_params);
}

/**
 * Get wind parameters
 * @method module:scenes.get_wind_params
 */
exports["get_wind_params"] = function() {
    return m_scenes.get_wind_params();
}

/**
 * Set wind parameters
 * @method module:scenes.set_wind_params
 * @param {object} wind params 
 */
exports["set_wind_params"] = function(wind_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.set_wind_params(active_scene, wind_params);
}

/**
 * Get water shore distance
 * @method module:scenes.get_water_surface_level
 */
exports["get_water_surface_level"] = m_scenes.get_water_surface_level;

/**
 * Set water params
 * @method module:scenes.set_water_params
 * @param {object} water params
 */
exports["set_water_params"] = function(water_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.set_water_params(active_scene, water_params);
}

/**
 * Get water material parameters
 * @method module:scenes.get_water_mat_params
 * @param {object} water params
 */
exports["get_water_mat_params"] = function(water_params) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.get_water_mat_params(active_scene, water_params);
}

/**
 * Update scene materials parameters
 * @method module:scenes.update_scene_materials_params
 */
exports["update_scene_materials_params"] = function() {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }
    var active_scene = m_scenes.get_active();
    m_scenes.update_scene_permanent_uniforms(active_scene);
}

/**
 * Append object to active scene.
 * @method module:scenes.append_object
 * @deprecated Unused
 */
exports["append_object"] = function(obj) {
    throw "Method \"append_object\" is deprecated";
}

/**
 * @method module:scenes.add_object
 * @deprecated Unused
 */
exports["add_object"] = function(obj) {
    throw "Method \"add_object\" is deprecated";
}

/**
 * Remove object from active scene.
 * @method module:scenes.remove_object
 * @deprecated Unused
 */
exports["remove_object"] = function(obj) {
    throw "Method \"remove_object\" is deprecated";
}


/**
 * Hide object on active scene.
 * @method module:scenes.hide_object
 * @param obj Object ID
 */
exports["hide_object"] = function(obj) {
    var scene = m_scenes.get_active();
    m_scenes.hide_object(scene, obj);
}

/**
 * Show object on active scene.
 * @method module:scenes.show_object
 * @param obj Object ID
 */
exports["show_object"] = function(obj) {
    var scene = m_scenes.get_active();
    m_scenes.show_object(scene, obj);
}

/**
 * Check object availability on active scene.
 * @method module:scenes.check_object
 * @param name Object name
 */
exports["check_object"] = function(obj) {
    if (!m_scenes.check_active()) {
        m_print.error("No active scene");
        return false;
    }

    return m_scenes.check_object(obj, m_scenes.get_active());
}

/**
 * Remove all objects from all scenes.
 * @method module:scenes.remove_all
 */
exports["remove_all"] = function() {
    throw("unimplemented");
}
/**
 * Check if object collides with object/material having given collision ID.
 * @method module:scenes.check_collision
 * @deprecated By async physics
 */
exports["check_collision"] = function() {
    return false;
}
/**
 * Check if ray hit near collision ID.
 * @method module:scenes.check_ray_hit
 * @deprecated By async physics
 */
exports["check_ray_hit"] = function() {
    return false;
}

/**
 * Get object name.
 * @method module:scenes.get_object_name
 * @param obj Object ID
 */
exports["get_object_name"] = function(obj) {
    if (!obj) {
        m_print.error("Wrong object name");
        return "";
    }

    return obj["name"];
}

/**
 * Get object type.
 * @method module:scenes.get_object_type
 * @param obj Object ID
 */
exports["get_object_type"] = function(obj) {
    if (!(obj && obj["type"])) {
        m_print.error("Wrong object ID");
        return "UNDEFINED";
    }

    return obj["type"];
}

/**
 * Return object children.
 * @method module:scenes.get_object_children
 * @param obj Object ID
 */
exports["get_object_children"] = function(obj) {
    return obj._descends.slice(0);
}

/**
 * Find first character on active scene.
 */
exports["get_first_character"] = function() {
    var sobjs = m_scenes.get_scene_objs(m_scenes.get_active(), "MESH");
    for (var i = 0; i < sobjs.length; i++) {
        var obj = sobjs[i];
        if (physics.is_character(obj)) {
            return obj;
        }
    }
    return null;
}

/**
 * Return distance to shore line.
 * @method module:scenes.get_shore_dist
 * @param trans Current translation
 * @param [v_dist_mult=1] Vertical distance multiplier
 */
exports["get_shore_dist"] = function(trans, v_dist_mult) {
    if (!v_dist_mult && v_dist_mult !== 0)
        v_dist_mult = 1;

    return m_scenes.get_shore_dist(trans, v_dist_mult);
}

/**
 * Return camera water depth or null if no water.
 * @method module:scenes.get_cam_water_depth
 */
exports["get_cam_water_depth"] = function() {
    return m_scenes.get_cam_water_depth();
}

}
