var THREE = require('three');
var be_config = require('./config/backend.js');
var ObjMtlLoader = require("obj-mtl-loader");
var OrbitControls = require('three-orbit-controls')(THREE);
var request = require('request');
var FormData = require('form-data');
var Timer = require('easytimer.js');

var scope;

var PartAnnotator = function(params) {

    this.bg_color_normal = 0xffffff;

    this.scene3d = $("#main_3d_canvas");
    this.CANVAS_WIDTH = this.scene3d.width();
    this.CANVAS_HEIGHT = this.scene3d.height();
    console.log('width: ', this.CANVAS_WIDTH, ' height: ', this.CANVAS_HEIGHT);

    this.anno_id = parseInt(params.anno_id);
    this.load_parent_anno = (params.load_parent_anno == 'true');
    this.allow_edit = (params.allow_edit == 'true');

    scope = this;

    this.timerInstance = new Timer();
    this.timerInstance.start();
    this.timerInstance.addEventListener('secondsUpdated', function (e) {
        $('#timer').html(scope.timerInstance.getTimeValues().toString());
    });

    scope.img_dir = 'imgs';
    scope.template_filename = 'template.json';
    scope.all_example_img_filelist = 'all_example_img_filelist.json';

    console.log('Anno Id: ', this.anno_id);
    console.log('Load Parent Anno: ', this.load_parent_anno);
    console.log('Allow Edit: ', this.allow_edit);

    // if not allow_edit
    if (!this.allow_edit) {
        console.log('Delete all buttons!');
        $('#next_question').remove();
        $('#clear_answer').remove();
        $('#edit_answer').remove();
        $('#instance_save').remove();
        $('#timer').remove();
    }

    // setup the camera, scene, render, lights
    this.camera = new THREE.PerspectiveCamera( 75, this.CANVAS_WIDTH / this.CANVAS_HEIGHT, 0.1, 1000 );
    this.camera.position.set(-1, 1, -1);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
        preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize( this.CANVAS_WIDTH, this.CANVAS_HEIGHT );

    this.scene3d.append(this.renderer.domElement);

    this.amb_light = new THREE.AmbientLight( 0x404040 );
    this.amb_light.intensity = 2;
    this.scene.add(this.amb_light);

    this.light1 = new THREE.PointLight(0xFFFFFF, 1, 100);
    this.light1.position.set(0, 50, 50);
    this.scene.add(this.light1);

    this.light2 = new THREE.PointLight(0xFFFFFF, 1, 100);
    this.light2.position.set(50, 0, 0);
    this.scene.add(this.light2);

    this.light3 = new THREE.PointLight(0xFFFFFF, 1, 100);
    this.light3.position.set(-50, 0, 0);
    this.scene.add(this.light3);

    this.light4 = new THREE.PointLight(0xFFFFFF, 1, 100);
    this.light4.position.set(0, -50, 50);
    this.scene.add(this.light4);

    this.wireframe_switch = false;

    // setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.minDistance = 0;
    this.controls.maxDistance = 15;
    this.controls.enablePan = true;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.addEventListener('change', this.render);
    this.controls.enableKeys = false;

    // listen to UI interactions
    window.addEventListener( 'resize', this.on_window_resize, false );
    this.renderer.domElement.addEventListener('mousemove',
        function() {
            scope.mouse_x = ( ( event.clientX - scope.renderer.domElement.offsetLeft ) / scope.renderer.domElement.clientWidth ) * 2 - 1;
            scope.mouse_y = - ( ( event.clientY - scope.renderer.domElement.offsetTop ) / scope.renderer.domElement.clientHeight ) * 2 + 1;

            if (scope.threed_ui_state === 'remesh_cut') {
                scope.part_cut_mouse_hoover();
            }
        });

    // raycaster and mouse interactions
    this.mouse_x = null;
    this.mouse_y = null;

    this.renderer.setClearColor(new THREE.Color(this.bg_color_normal));

    // listen for the "keypress" event
    $(document).keypress(this.process_key_press);

    // set up for the plane clipping
    var clipping_plane_x = new THREE.Plane( new THREE.Vector3( 1, 0, 0 ), 1 );
    var clipping_plane_y = new THREE.Plane( new THREE.Vector3( 0, -1, 0 ), 1 );
    var clipping_plane_z = new THREE.Plane( new THREE.Vector3( 0, 0, 1 ), 1 );

    this.plane_clipping_x = 1;
    this.plane_clipping_y = 1;
    this.plane_clipping_z = 1;

    var globalPlanes = [ clipping_plane_x, clipping_plane_y, clipping_plane_z ], Empty = Object.freeze( [] );

    // plane clipping GUI
    this.gui = new dat.GUI();
    plane_clipping_name = 'Plane Clipping';

    this.folderGlobal = this.gui.addFolder(plane_clipping_name);
    this.propsGlobal = {
        get 'X' () { return clipping_plane_x.constant; },
        set 'X' ( v ) {
            clipping_plane_x.constant = v;
            scope.plane_clipping_x = v;
            scope.render();
            },
        get 'Y' () { return clipping_plane_y.constant; },
        set 'Y' ( v ) {
            clipping_plane_y.constant = v;
            scope.plane_clipping_y = v;
            scope.render();
        },
        get 'Z' () { return clipping_plane_z.constant; },
        set 'Z' ( v ) {
            clipping_plane_z.constant = v;
            scope.plane_clipping_z = v;
            scope.render();
        }
    };

    this.renderer.clippingPlanes = globalPlanes;
    this.folderGlobal.add( this.propsGlobal, 'X', -1, 1 ); this.folderGlobal.__controllers[0].domElement.hidden = false;
    this.folderGlobal.add( this.propsGlobal, 'Y', -1, 1 ); this.folderGlobal.__controllers[1].domElement.hidden = false;
    this.folderGlobal.add( this.propsGlobal, 'Z', -1, 1 ); this.folderGlobal.__controllers[2].domElement.hidden = false;
    this.folderGlobal.open();

    this.other_str = 'other';
    this.other_leaf_str = 'other_leaf';

    // setup for 3d UI
    this.threed_setup();
    this.remesh_setup();

    // setup for part hierarchy
    this.part_hier_setup();

    // q&a setup
    this.qa_setup();
};

// process keypress
PartAnnotator.prototype.process_key_press = function(event) {
    var target = event.target || event.srcElement;
    var targetTagName = (target.nodeType == 1) ? target.nodeName.toUpperCase() : "";
    if ( !/INPUT|SELECT|TEXTAREA/.test(targetTagName) ) {
        if (event.keyCode === 87 || event.keyCode === 119) {

            // W/w --> toggle wireframe on/off
            scope.wireframe_switch = !scope.wireframe_switch;
            scope.toggle_wireframe();

        } else if (event.keyCode === 82 || event.keyCode === 114) {

            // R/r --> toggle camera reset
            scope.on_window_resize();

        } else if (event.keyCode === 83 || event.keyCode === 115) {

            // S/s--> select part/point
            if (scope.toggle_remesh_show_global) {
                alert('You are now at the viewing mode that shows the part in the context of the entire shape. ' +
                    'No annotation is allowed. Please press G/g to exit the viewing mode first!');
                return;
            }

            switch(scope.threed_ui_state) {
                case "idle":
                    alert('Please answer the question on the left! You can only annotate parts on the model when we ask you to do so!');
                    break;
                case "part_select":
                    scope.process_part_select();
                    break;
                case "remesh_wait":
                    alert('Please wait for remeshing result!');
                    break;
                case "remesh_segment":
                    scope.process_remesh_point_click();
                    break;
                case "remesh_cut":
                    scope.process_remesh_part_select();
                    break;
                case "remesh_final":
                    alert('You have finished the cutting for this part! Please press B/b to submit. Press U/u to undo the last part cut!');
                    break;
            }

        } else if (event.keyCode === 77 || event.keyCode === 109) {

            // M/m --> request remesh the current set of selected parts
            switch(scope.threed_ui_state) {
                case "part_select":
                    scope.process_remeshing_request();
                    break;
                case "remesh_wait":
                    alert('Please wait for remeshing result!');
                    break;
                case "remesh_segment":
                    var prompt_str;
                    prompt_str = 'Are you sure to undo the current part cutting? If yes, all of your boundary segments and part cuts will be deleted!';
                    if (confirm(prompt_str)) {
                        scope.undo_current_remeshing();
                    }
                    break;
                case "remesh_cut":
                    var prompt_str;
                    prompt_str = 'Are you sure to undo the current part cutting? If yes, all of your boundary segments and part cuts will be deleted!';
                    if (confirm(prompt_str)) {
                        scope.undo_current_remeshing();
                    }
                    break;
                case "remesh_final":
                    var prompt_str;
                    prompt_str = 'Are you sure to undo the current part cutting? If yes, all of your boundary segments and part cuts will be deleted!';
                    if (confirm(prompt_str)) {
                        scope.undo_current_remeshing();
                    }
                    break;
            }

        } else if (event.keyCode === 68 || event.keyCode === 100) {

            // D/d --> delete point/last part cut (for remeshed part cutting only)
            if (scope.toggle_remesh_show_global) {
                alert('You are now at the viewing mode that shows the part in the context of the entire shape. ' +
                    'No annotation is allowed. Please press G/g to exit the viewing mode first!');
                return;
            }

            if (scope.threed_ui_state === 'remesh_segment') {
                scope.process_remesh_point_delete();
            }

        } else if (event.keyCode === 67 || event.keyCode === 99) {

            // C/c --> process a part cut (for remeshed part cutting only)
            if (scope.toggle_remesh_show_global) {
                alert('You are now at the viewing mode that shows the part in the context of the entire shape. ' +
                    'No annotation is allowed. Please press G/g to exit the viewing mode first!');
                return;
            }

            if (scope.threed_ui_state === 'remesh_segment') {
                scope.process_part_cut();
            }

        } else if (event.keyCode === 85 || event.keyCode === 117) {

            // U/u --> process a part cut undo (for remeshed part cutting only)
            if (scope.toggle_remesh_show_global) {
                alert('You are now at the viewing mode that shows the part in the context of the entire shape. ' +
                    'No annotation is allowed. Please press G/g to exit the viewing mode first!');
                return;
            }

            switch(scope.threed_ui_state) {
                case "remesh_wait":
                    alert('Please wait for remeshing result!');
                    break;
                case "remesh_segment":
                    if (scope.total_part_cut ===0) {
                        alert('There is no part cut at all!');
                        break;
                    }
                    if(scope.boundary_segments.length > 0) {
                        var prompt_str;
                        prompt_str = 'We detect that you are generating the segmentation boundary for the next part. Are you sure ' +
                            'to undo the last part cut? The segments you are generating will be removed!';
                        if (confirm(prompt_str)) {
                            scope.process_boundary_delete_all();
                            scope.process_part_cut_undo();
                        }
                    } else {
                        scope.process_part_cut_undo();
                    }
                    break;
                case "remesh_cut":
                    scope.undo_current_boundary_cut();
                    break;
                case "remesh_final":
                    scope.process_part_cut_undo();
                    scope.threed_ui_state = 'remesh_segment';
                    break;
            }

        } else if (event.keyCode === 88 || event.keyCode === 120) {

            // X/x --> delete the current boundary (for remeshed part cutting only)
            if (scope.toggle_remesh_show_global) {
                alert('You are now at the viewing mode that shows the part in the context of the entire shape. ' +
                    'No annotation is allowed. Please press G/g to exit the viewing mode first!');
                return;
            }

            switch(scope.threed_ui_state) {
                case "remesh_segment":
                    scope.process_boundary_delete();
                    break;
                case "remesh_final":
                    alert('You have finished the cutting for this part! Please press B/b to submit. Press U/u to undo the last part cut!');
                    break;
            }

        } else if (event.keyCode === 91 || event.keyCode === 123) {

            // [/{ --> select the previous boundary edge (for remeshed part cutting only)
            if (scope.toggle_remesh_show_global) {
                alert('You are now at the viewing mode that shows the part in the context of the entire shape. ' +
                    'No annotation is allowed. Please press G/g to exit the viewing mode first!');
                return;
            }

            switch(scope.threed_ui_state) {
                case "remesh_segment":
                    scope.select_previous_segment();
                    break;
                case "remesh_final":
                    alert('You have finished the cutting for this part! Please press B/b to submit. Press U/u to undo the last part cut!');
                    break;
            }

        } else if (event.keyCode === 93 || event.keyCode === 125) {

            // ]/} --> select/generate the next boundary edge (for remeshed part cutting only)
            if (scope.toggle_remesh_show_global) {
                alert('You are now at the viewing mode that shows the part in the context of the entire shape. ' +
                    'No annotation is allowed. Please press G/g to exit the viewing mode first!');
                return;
            }

            switch(scope.threed_ui_state) {
                case "remesh_segment":
                    scope.select_next_segment();
                    break;
                case "remesh_final":
                    alert('You have finished the cutting for this part! Please press B/b to submit. Press U/u to undo the last part cut!');
                    break;
            }

        } else if (event.keyCode === 66 || event.keyCode === 98) {

            // b/B --> submit the part cutting result
            if (scope.toggle_remesh_show_global) {
                alert('You are now at the viewing mode that shows the part in the context of the entire shape. ' +
                    'Please press G/g to exit the viewing mode first!');
                return;
            }

            switch(scope.threed_ui_state) {
                case "remesh_segment":
                    if(scope.boundary_segments.length > 0) {
                        var prompt_str;
                        prompt_str = 'We detect that you are generating the segmentation boundary for the next part. Are you sure ' +
                            'to submit the current results? The segments you are generating will be removed!';
                        if (confirm(prompt_str)) {
                            scope.process_boundary_delete_all();
                            scope.gen_last_part_cut_before_submission();
                        }
                    } else {
                        scope.gen_last_part_cut_before_submission();
                    }
                    break;
                case "remesh_cut":
                    alert('Please select a part cut from the last boundary cutting!');
                    break;
                case "remesh_final":
                    scope.submit_part_cutting_result();
                    break;
            }

        }  else if (event.keyCode === 71 || event.keyCode === 103) {

            // g/G --> Show/Hide global shape context during part cutting
            switch(scope.threed_ui_state) {
                case "remesh_wait":
                    alert('Please wait for remeshing result!')
                    break;
                case "remesh_cut":
                    alert('Please select a part cut from the last boundary cutting!');
                    break;
                case "remesh_segment":
                    scope.remesh_toggle_show_global_shape_context();
                    break;
                case "remesh_final":
                    scope.remesh_toggle_show_global_shape_context();
                    break;
            }
        } else if (event.keyCode === 65 || event.keyCode === 97) {

            switch(scope.threed_ui_state) {
                case "idle":
                case "part_select":
                    // a/A --> trigger next question
                    if (!$('#next_question').prop('disabled')) {
                        scope.next_question();
                    } else {
                        alert('You cannot go to the next question now!');
                    }
            }


        } else if (event.keyCode === 69 || event.keyCode === 101) {

            switch(scope.threed_ui_state) {
                case "idle":
                case "part_select":
                    // e/E --> trigger edit answer
                    if (!$('#edit_answer').prop('disabled')) {
                        scope.question_edit_answer();
                    } else {
                        alert('You cannot edit this answer! You can only edit the answer to the AND node question ' +
                            'you have answered before!');
                    }
            }

        } else if (event.keyCode === 90 || event.keyCode === 122) {

            switch(scope.threed_ui_state) {
                case "idle":
                case "part_select":
                    // z/Z --> trigger clear answer
                    if (!$('#clear_answer').prop('disabled')) {
                        scope.question_clear_answer();
                    } else {
                        alert('You cannot clear the answer for this question! Have you answered this question before?');
                    }
            }

        }
    }
};

PartAnnotator.prototype.start = function () {

    var url = be_config.remoteHost + ':' + be_config.remotePort + be_config.get_anno_info + '/' + scope.anno_id;
    console.log(url)

    request.get(url, function (error, response, body) {

        console.log(error)

        if (response.statusCode === 200) {
            var data = JSON.parse(body);

            scope.model_cat = data.model_cat;
            scope.model_id = data.model_id;
            scope.username = data.username;
            scope.anno_version = data.version;

            console.log('Model Cat: ' + scope.model_cat);
            console.log('Model ID: ' + scope.model_id);
            console.log('Username: ' + scope.username);
            console.log('Version: ' + scope.anno_version);

            // load wordnet words
            scope.load_wordnet_words();

            // load example img filelist
            scope.load_example_img_filelist();

            // load part hier
            scope.load_part_hier_template();

            // load model screenshots
            scope.load_model_screenshots(0);

            // allow horizontal mouse middle scrolling
            $.fn.hScroll = function (amount) {
                amount = amount || 120;
                $(this).bind("DOMMouseScroll mousewheel", function (event) {
                    var oEvent = event.originalEvent,
                        direction = oEvent.detail ? oEvent.detail * -amount : oEvent.wheelDelta,
                        position = $(this).scrollLeft();
                    position += direction > 0 ? -amount : amount;
                    $(this).scrollLeft(position);
                    event.preventDefault();
                })
            };

            $('#model_screenshots').hScroll();

            // wait for template hier to be loaded before loading
            // the instance tree and its associated obj files
            var check_obj_load_finish = function() {
                if (scope.num_obj_to_load !== undefined && scope.current_num_obj_loaded === scope.num_obj_to_load) {
                    clearInterval(scope.check_obj_load_finish_interval);

                    // set up the clipping plane boundaries
                    scope.plane_x_min = undefined; scope.plane_x_max = undefined;
                    scope.plane_y_min = undefined; scope.plane_y_max = undefined;
                    scope.plane_z_min = undefined; scope.plane_z_max = undefined;

                    for (let obj of scope.scene.children) {
                        if (obj.type === 'Mesh') {
                            var verts = obj.geometry.vertices;
                            for (let v of verts) {
                                if (scope.plane_x_min === undefined || v.x < scope.plane_x_min) scope.plane_x_min = v.x;
                                if (scope.plane_x_max === undefined || v.x > scope.plane_x_max) scope.plane_x_max = v.x;
                                if (scope.plane_y_min === undefined || v.y < scope.plane_y_min) scope.plane_y_min = v.y;
                                if (scope.plane_y_max === undefined || v.y > scope.plane_y_max) scope.plane_y_max = v.y;
                                if (scope.plane_z_min === undefined || v.z < scope.plane_z_min) scope.plane_z_min = v.z;
                                if (scope.plane_z_max === undefined || v.z > scope.plane_z_max) scope.plane_z_max = v.z;
                            }
                        }
                    }

                    scope.folderGlobal.__controllers[0].__min = -scope.plane_x_max - 0.1;
                    scope.folderGlobal.__controllers[0].__max = -scope.plane_x_min + 0.1;
                    scope.folderGlobal.__controllers[0].updateDisplay();
                    scope.folderGlobal.__controllers[0].setValue(-scope.plane_x_min+0.1);

                    scope.folderGlobal.__controllers[1].__min = scope.plane_y_min - 0.1;
                    scope.folderGlobal.__controllers[1].__max = scope.plane_y_max + 0.1;
                    scope.folderGlobal.__controllers[1].updateDisplay();
                    scope.folderGlobal.__controllers[1].setValue(scope.plane_y_max+0.1);

                    scope.folderGlobal.__controllers[2].__min = -scope.plane_z_max - 0.1;
                    scope.folderGlobal.__controllers[2].__max = -scope.plane_z_min + 0.1;
                    scope.folderGlobal.__controllers[2].updateDisplay();
                    scope.folderGlobal.__controllers[2].setValue(-scope.plane_z_min+0.1);

                    // load the other stuffs
                    if (scope.load_parent_anno && scope.anno_version > 0) {
                        scope.process_load_parent_anno();
                    } else {
                        scope.save_first_snapshot();
                    }
                }
            };

            var check_load_part_hier_template = function() {
                if (scope.switch_load_part_hier_template === true) {
                    clearInterval(scope.check_load_part_hier_template_interval);

                    if (scope.load_parent_anno && scope.anno_version > 0) {
                        // start from parent obj file list
                        // load the model original scene-graph to start
                        var scene_graph_url = be_config.remoteHost + ':' + be_config.remotePort +
                            be_config.get_anno_obj_list + '/' + scope.anno_id + '-' + scope.anno_version;
                        scope.load_parent_obj_list(scene_graph_url);
                    } else {
                        // start from scratch
                        // load the model original scene-graph to start
                        var scene_graph_url = be_config.remoteHost + ':' + be_config.remotePort +
                            be_config.get_original_scene_graph + '/' + scope.model_cat + '/' + scope.model_id;
                        scope.load_leaf_part_json(scene_graph_url);
                    }

                    scope.check_obj_load_finish_interval = setInterval(check_obj_load_finish, 1000);
                }
            };

            scope.check_load_part_hier_template_interval = setInterval(check_load_part_hier_template, 1000);

        } else {
            alert('[ERROR start]: error when loading the annotation record ', scope.anno_id);
        }
    })
};

// render
PartAnnotator.prototype.render = function () {
    scope.renderer.render( scope.scene, scope.camera );
};


// for rendering
PartAnnotator.prototype.on_window_resize = function() {

    scope.CANVAS_WIDTH = scope.scene3d.width();
    scope.CANVAS_HEIGHT = scope.scene3d.height();

    console.log('[on window resize] width: ', scope.CANVAS_WIDTH+ ' height: ', scope.CANVAS_HEIGHT);

    scope.camera.aspect = scope.CANVAS_WIDTH / scope.CANVAS_HEIGHT;
    scope.camera.updateProjectionMatrix();

    scope.renderer.setSize( scope.CANVAS_WIDTH, scope.CANVAS_HEIGHT );

    scope.controls.reset();
    scope.render();
};

PartAnnotator.prototype.toggle_wireframe = function() {
    scope.scene.children.forEach(function (child) {
        if(child.type === 'Mesh' && child.is_part_mesh) {
            for (let mat of child.material) {
                mat.wireframe = scope.wireframe_switch;
            }
        }
    });
    scope.render();
};

// show instruction at beginning
PartAnnotator.prototype.show_instruction = function() {
    var instr = '\n********* Camera Control *************\n';
    instr += '[Mouse: left] --> Drag at orbit-view mode\n';
    instr += '[Mouse: right] --> Drag at Pan-view model\n';
    instr += '[Mouse: middle] --> Change the model scale\n';
    instr += 'R/r --> reset the camera\n';
    instr += 'W/w --> Open/close wireframe mode\n';
    instr += '\n******* Part Selection ********\n'
    instr += 'S/s --> Select/De-select Part\n';
    instr += '\n******* Part Cut ********\n'
    instr += 'M/m --> Request/Undo request remeshing \n\t\t(Please wait a while for remeshing results!)\n';
    instr += 'G/g --> Show/Hide the global shape context during part cutting\n';
    instr += 'S/s --> Select a Point\n';
    instr += 'D/d --> De-Select a Point\n';
    instr += ']   --> Generate next cut segment\n';
    instr += '[/] --> Navigate between all current cut segments\n';
    instr += 'X/x --> Delete current segment\n';
    instr += 'C/c --> Perform part cutting\n';
    instr += 'U/u --> Undo the last cut / Exit the cut selection stage\n';
    instr += 'B/b --> Submit the part cutting\n';

    alert('Instructions:'+instr);
};



// -----------------------------------------------------------
//        MODULE: UI Loading Stuffs
// -----------------------------------------------------------


PartAnnotator.prototype.load_wordnet_words = function() {
    var file_path = '/wordnet_words_small.json';
    console.log('[Load WordNet Words ]: loading from '+file_path);
    var xmlhttp = new XMLHttpRequest();
    scope = this;
    xmlhttp.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
            scope.wordnet_words = JSON.parse(this.responseText);
            console.log('[load WordNet Words] successfully loaded '+scope.wordnet_words.length+' words from WordNet!');

            scope.wordnet_words.forEach(function(item) {
                var option = document.createElement('option');
                option.value = item;
                $('#wordnet_words').append(option);
            });
        }
    };
    xmlhttp.open("GET", file_path, true);
    xmlhttp.send();
};

PartAnnotator.prototype.load_model_screenshots = function(image_id) {
    var file_path = be_config.remoteHost+':'+be_config.remotePort+be_config.get_model_screenshot+'/'+
        scope.model_id+'/'+image_id;
    console.log('[Load Model ScreenShot ]: loading from '+file_path);
    var xmlhttp = new XMLHttpRequest();
    scope = this;
    xmlhttp.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
            var outputImg = document.createElement('img');
            outputImg.style.height = '90%';
            var urlCreator = window.URL || window.webkitURL;
            outputImg.src = urlCreator.createObjectURL(this.response);
            document.getElementById('model_screenshots').appendChild(outputImg);
            scope.load_model_screenshots(image_id + 1);
        }
    };
    xmlhttp.responseType = "blob";
    xmlhttp.open("GET", file_path, true);
    xmlhttp.send();
};

// load parent anno obj list
PartAnnotator.prototype.load_parent_obj_list = function(file_path) {
    console.log('[load_parent_obj_list]: loading from '+file_path);
    var xmlhttp = new XMLHttpRequest();
    scope = this;
    xmlhttp.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
            var scene_graph_json = JSON.parse(this.responseText);
            scope.num_obj_to_load = scene_graph_json.length;
            for (let partname of scene_graph_json) {
                var partname_list = partname.split('-');
                var part_type = partname_list[0];
                var part_id = partname_list[1];
                scope.load_obj(part_type, part_id);
            }
        }
    };
    xmlhttp.open("GET", file_path, true);
    xmlhttp.send();
};

// load obj scene-graph tree
PartAnnotator.prototype.load_leaf_part_json = function(file_path) {
    console.log('[Load Leaf Part Json]: loading from '+file_path);
    var xmlhttp = new XMLHttpRequest();
    scope = this;
    xmlhttp.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
            var leaf_node_part_list = JSON.parse(this.responseText);
            scope.num_obj_to_load = leaf_node_part_list.length;
            for (let item of leaf_node_part_list) {
                scope.load_obj('original', item);
            }
        }
    };
    xmlhttp.open("GET", file_path, true);
    xmlhttp.send();
};

// Get snapshot
PartAnnotator.prototype.get_snapshot = function() {
     try {
        scope.snapshot = scope.renderer.domElement.toDataURL("image/jpeg");
        console.log('[get snapshot] Got image snapshot!');
    } catch (err) {
        console.log('[get snapshot] error: '+err);
    };
};

PartAnnotator.prototype.get_current_scene_obj_list = function() {
    var res = [];
    for (let obj of scope.scene.children) {
        if (obj.type ===  'Mesh' && obj.is_part_mesh && obj.part_type !== 'remesh') {
            res.push(obj.part_type+'-'+obj.part_id);
        }
    }
    return res;
};



// -----------------------------------------------------------
//        MODULE: 3D UI: Init and Load Model
// -----------------------------------------------------------


PartAnnotator.prototype.threed_setup = function() {
    // states:  idle, part_select, remesh_wait, remesh_show_global,
    //          remesh_segment, remesh_cut, remesh_final
    scope.threed_ui_state = 'idle';
    scope.toggle_remesh_show_global = false;

    scope.current_num_obj_loaded = 0;

    scope.current_part_color = 0xFF00000;
    scope.default_part_color = 0xD3D3D3;
};

// load single obj
PartAnnotator.prototype.load_obj = function (part_type, part_id) {

    var file_path = be_config.remoteHost+':'+be_config.remotePort;

    if (part_type === 'original') {
        file_path += be_config.get_original_part + '/' + scope.model_cat + '/' +
            scope.model_id + '/' + part_id;
    } else if (part_type === 'new') {
        file_path += be_config.get_new_part + '/' + scope.anno_id + '-' + part_id;
    } else if (part_type === 'remesh') {
        file_path += be_config.get_remesh_part + '/' + scope.anno_id + '-' + part_id;
    } else {
        console.error('[Load OBJ] part type '+part_type+' is not valid!');
        return;
    }

    console.log('[Load OBJ]: loading from '+file_path);

    var objMtlLoader = new ObjMtlLoader();
    scope = this;

    objMtlLoader.load(file_path, function(err, result) {
        if(err){
            console.log('ERROR loading from '+file_path);
        }

        var vertices = result.vertices;
        var faces = result.faces;
        var geometry = new THREE.Geometry();
        for(var i = 0; i < vertices.length; ++i) {
            var point = new THREE.Vector3(vertices[i][0], vertices[i][1], vertices[i][2]);
            geometry.vertices.push(point);
        }
        for(i = 0; i < faces.length; ++i) {
            for (var j = 1; j <= faces[i].indices.length - 2; ++j) {
                var face = new THREE.Face3(faces[i].indices[0] - 1, faces[i].indices[j] - 1, faces[i].indices[j + 1] - 1);
                face.faceid = i;
                geometry.faces.push(face);
            }
        }
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();

        var opacMaterial = new THREE.MeshPhongMaterial({
            transparent:true,
            opacity:0.2,
            color: scope.default_part_color,
            vertexColors: THREE.VertexColors,
            side: THREE.DoubleSide,
            flatShading: true
        });
        var solidMaterial = new THREE.MeshPhongMaterial({
            transparent:false,
            color: scope.default_part_color,
            vertexColors: THREE.VertexColors,
            side: THREE.DoubleSide,
            flatShading: true
        });

        var mesh = new THREE.Mesh(geometry, [solidMaterial, opacMaterial]);

        mesh.part_id = part_id;
        mesh.part_type = part_type;
        mesh.is_part_mesh = true;

        mesh.url = file_path;
        mesh.part_select = false;

        console.log('vertex number: '+mesh.geometry.vertices.length);
        console.log('face number: '+mesh.geometry.faces.length);

        scope.scene.add(mesh);

        if (part_type === 'original' || part_type === 'new') {

            scope.renderer.setClearColor(new THREE.Color(scope.bg_color_normal));
            scope.render();

        } else if (part_type === 'remesh') {

            // at the remeshing stage, just hide all the parts
            // but show the part that is being divided

            scope.threed_ui_state = 'remesh_segment';
            scope.remesh_part_init(mesh);

            scope.renderer.setClearColor(new THREE.Color(scope.bg_color_remesh));
            scope.render();
        }

        ++ scope.current_num_obj_loaded;
    });
};


// -----------------------------------------------------------
//               MODULE: 3D UI: Part Select
// -----------------------------------------------------------


// part select state init
PartAnnotator.prototype.part_select_init = function() {

    console.log('[part_select_init]');

    if (scope.selected_part_objs !== undefined) {
        for (let obj of scope.selected_part_objs) {
            obj.part_select = false;
            for (let mat of obj.material) {
                if (obj.assigned_color === undefined) {
                    mat.color.setHex(scope.default_part_color);
                } else {
                    mat.color.set(obj.assigned_color);
                }
            }
        }

        scope.render();
    }

    scope.selected_part_objs = new Set();
};

// process part click
PartAnnotator.prototype.process_part_select = function() {
    var raycaster = new THREE.Raycaster();
    console.log('[Process Part Select] Point: '+scope.mouse_x+', '+scope.mouse_y);
    raycaster.setFromCamera(new THREE.Vector2(scope.mouse_x, scope.mouse_y), scope.camera);
    var intersects = raycaster.intersectObjects(scope.scene.children);
    var intersect_id = 0;
    while (intersect_id < intersects.length) {
        var obj = intersects[intersect_id].object;
        var point = intersects[intersect_id].point;
        var under_clipping = (point.x + scope.plane_clipping_x >= 0) &&
            (-point.y + scope.plane_clipping_y >= 0) &&
            (point.z + scope.plane_clipping_z >= 0);
        console.log(under_clipping, point, scope.plane_clipping_x, scope.plane_clipping_y, scope.plane_clipping_z);
        if (obj instanceof THREE.Mesh && obj.is_part_mesh && obj.visible && under_clipping) {
            break;
        }
        ++ intersect_id;
    }
    if (intersect_id < intersects.length) {
        var selected_part = intersects[intersect_id].object;

        if (selected_part.assigned_color === undefined) {
            selected_part.part_select = !selected_part.part_select;
            if (selected_part.part_select) {
                scope.selected_part_objs.add(selected_part);

                for (let mat of selected_part.material) {
                    mat.color.setHex(scope.current_part_color);
                    console.log('[Process Part Select] assign color', scope.current_part_color);
                }
            } else {
                scope.selected_part_objs.delete(selected_part);

                for (let mat of selected_part.material) {
                    mat.color.setHex(scope.default_part_color);
                    console.log('[Process Part Select] assign default part color');
                }
            }

            console.log('[Process Part Select] render');
            scope.render();
        }
    }
};

// -----------------------------------------------------------
//            MODULE: 3D UI: Part Remeshing
// -----------------------------------------------------------


// some const variables for remeshing and part cutting
PartAnnotator.prototype.remesh_setup = function() {
    scope.bg_color_remesh = 0xADD8E6;

    scope.color_segment_normal = "yellow";
    scope.color_segment_highlight = "blue";

    scope.segment_sphere_radius = 0.02;
    scope.remesh_boundary_line_width = 0.01;

    // compute the ratio between the bbox of the part and the bbox for the entire shape
    scope.radius_multiplier = null;
};

// init for the remeshed part
PartAnnotator.prototype.remesh_part_init = function(mesh) {
    scope.cut_edge_set = null;
    scope.total_part_cut = null;

    // for part cuts during remeshing
    scope.remesh_part_seg = [];
    scope.remesh_part_seg_color = [];

    // for new part cuts when cutting for a new part (shown in alpha mode)
    scope.remesh_new_part_seg = [];
    scope.remesh_new_part_seg_color = [];

    mesh.visible = true;

    var bbox = scope.compute_meta_information(mesh);

    var part_x_len = bbox.max.x - bbox.min.x;
    var part_y_len = bbox.max.y - bbox.min.y;
    var part_z_len = bbox.max.z - bbox.min.z;

    var part_x_center = (bbox.max.x + bbox.min.x) / 2;
    var part_y_center = (bbox.max.y + bbox.min.y) / 2;
    var part_z_center = (bbox.max.z + bbox.min.z) / 2;

    mesh.center_offset = new THREE.Vector3(-part_x_center, -part_y_center, -part_z_center);

    var shape_x_len = scope.folderGlobal.__controllers[0].__max - scope.folderGlobal.__controllers[0].__min;
    var shape_y_len = scope.folderGlobal.__controllers[1].__max - scope.folderGlobal.__controllers[1].__min;
    var shape_z_len = scope.folderGlobal.__controllers[2].__max - scope.folderGlobal.__controllers[2].__min;

    var radius_ratio = 0;
    if (part_x_len / shape_x_len > radius_ratio) radius_ratio = part_x_len / shape_x_len;
    if (part_y_len / shape_y_len > radius_ratio) radius_ratio = part_y_len / shape_y_len;
    if (part_z_len / shape_z_len > radius_ratio) radius_ratio = part_z_len / shape_z_len;
    scope.radius_multiplier = radius_ratio;

    scope.scene.children.forEach(function (child) {
        if (child.type === 'Mesh' && child.is_part_mesh) {
            if (!(child.part_type === mesh.part_type && child.part_id === mesh.part_id)) {
                child.visible = false;
            }
            child.geometry.translate(mesh.center_offset.x, mesh.center_offset.y, mesh.center_offset.z);
        }
    });

    // shift plane clipping range
    scope.folderGlobal.__controllers[0].__min -= mesh.center_offset.x;
    scope.folderGlobal.__controllers[0].__max -= mesh.center_offset.x;
    scope.plane_clipping_x -= mesh.center_offset.x;
    scope.folderGlobal.__controllers[0].updateDisplay();
    scope.folderGlobal.__controllers[0].setValue(scope.plane_clipping_x);

    scope.folderGlobal.__controllers[1].__min += mesh.center_offset.y;
    scope.folderGlobal.__controllers[1].__max += mesh.center_offset.y;
    scope.plane_clipping_y += mesh.center_offset.y;
    scope.folderGlobal.__controllers[1].updateDisplay();
    scope.folderGlobal.__controllers[1].setValue(scope.plane_clipping_y);

    scope.folderGlobal.__controllers[2].__min -= mesh.center_offset.z;
    scope.folderGlobal.__controllers[2].__max -= mesh.center_offset.z;
    scope.plane_clipping_z -= mesh.center_offset.z;
    scope.folderGlobal.__controllers[2].updateDisplay();
    scope.folderGlobal.__controllers[2].setValue(scope.plane_clipping_z);


    scope.render();

    scope.current_remesh_obj = mesh;

    for (var i = 0; i < mesh.geometry.faces.length; ++i) {
        scope.remesh_part_seg[i] = 0;
    }
};

// request remesh from the server
PartAnnotator.prototype.process_remeshing_request = function() {
    if (scope.selected_part_objs.size === 0) {
        alert('Please select some parts before requesting for remeshing!');
        return;
    }

    scope.init_segmentation_boundary();

    var obj_list = scope.selected_part_objs;

    var num_new_obj = 0, num_ori_obj = 0;
    for (let obj of obj_list) {
        if (obj.part_type === 'original') {
            ++ num_ori_obj;
        } else if (obj.part_type === 'new') {
            ++ num_new_obj;
        } else {
            alert('System Error, please contact admin. Error: [process_remeshing_request] unexpected mesh type: '+obj.part_type);
            return;
        }
    }

    if (num_new_obj === 0) {

        // send remeshing request to server and load the new mesh for part cutting
        var part_list_str = scope.model_cat + '_' + scope.model_id + '_' + scope.anno_id + '_';

        for (let obj of obj_list) {
            part_list_str += 'original-' + obj.part_id + '_';
        }
        part_list_str = part_list_str.slice(0, -1);

        console.log('[Request Remeshing] Part str: ' + part_list_str);

        scope.threed_ui_state = 'remesh_wait';
        document.getElementById("prompt").innerHTML = "Sending to server for remeshing! Please wait!";

        // hide the tree hier ui
        $('#tree_instance').fadeTo("slow", 0.5).css('pointer-events', 'none');
        $('#instance_save').prop('disabled', true);

        // hide the q&a
        $('.main_qa').fadeTo("slow", 0.5).css('pointer-events', 'none');

        // hide the 3d ui
        $('#main_3d_canvas').fadeTo("slow", 0.5).css('pointer-events', 'none');

        request(be_config.remoteHost + ':' + be_config.remotePort + be_config.request_remesh + '/' + part_list_str,
            function (error, response, body) {
                console.log(response.statusCode);
                if (response.statusCode === 200) {
                    console.log('get remesh new part id: ' + body);
                    scope.load_obj('remesh', body);

                    // show 3d ui
                    $('#main_3d_canvas').fadeTo("slow", 1).css('pointer-events', 'auto');

                    document.getElementById("prompt").innerHTML = "";
                }
            });

    } else if (num_new_obj === 1) {
        if (num_ori_obj === 0) {

            // just recompute the meta-info for the existing remeshed part cut and allow user to cut in for the second time
            var obj = obj_list.values().next().value;
            console.log('remeshing: ', obj);

            for (let mat of obj.material) {
                mat.color.setHex(scope.default_part_color);
            }

            // hide the tree hier ui
            $('#tree_instance').fadeTo("slow", 0.5).css('pointer-events', 'none');
            $('#instance_save').prop('disabled', true);

            // hide the q&a
            $('.main_qa').fadeTo("slow", 0.5).css('pointer-events', 'none');

            scope.threed_ui_state = 'remesh_segment';
            scope.remesh_part_init(obj);

            scope.renderer.setClearColor(new THREE.Color(scope.bg_color_remesh));
            scope.render();

        } else {
            alert('You cannot request remeshing for a mix of original parts and your new part cuts! ' +
                'The system only allows remeshing for a set of original parts or one of your new part cuts!');
            return;
        }
    } else if (num_new_obj > 1) {
        alert('You cannot request remeshing for more than one new part cuts! ' +
            'The system only allows remeshing for a set of original parts or one of your new part cuts!');
        return;
    }
};

// undo the current remeshing operation
PartAnnotator.prototype.undo_current_remeshing = function() {

    scope.process_boundary_delete_all();

    // show the tree hier ui
    $('#tree_instance').fadeTo("slow", 1).css('pointer-events', 'auto');
    $('#instance_save').prop('disabled', false);

    // show the q&a
    $('.main_qa').fadeTo("slow", 1).css('pointer-events', 'auto');

    scope.toggle_remesh_show_global = false;

    var offset_x = scope.current_remesh_obj.center_offset.x;
    var offset_y = scope.current_remesh_obj.center_offset.y;
    var offset_z = scope.current_remesh_obj.center_offset.z;

    scope.scene.children.forEach(function (child) {
        if(child instanceof THREE.Mesh && child.is_part_mesh) {
            if (child.part_type === 'remesh') {
                scope.scene.remove(child);
            } else {
                if (child.hidden === undefined) {
                    child.visible = true;
                }
                child.geometry.translate(-offset_x, -offset_y, -offset_z);
            }
        }
    });

    // if the current mesh is a new part, uncolor it
    if (scope.current_remesh_obj.part_type === 'new') {
        var obj = scope.current_remesh_obj;
        for (let mat of obj.material) {
            mat.color.setHex(scope.default_part_color);
        }
        var geom = obj.geometry;
        for (var i = 0; i < geom.faces.length; ++i) {
            geom.faces[i].color.setRGB(1, 1, 1);
            geom.faces[i].materialIndex = 0;
        }
        geom.colorsNeedUpdate = true;
        geom.groupsNeedUpdate = true;
    }

    // unshift plane clipping range
    scope.folderGlobal.__controllers[0].__min += offset_x;
    scope.folderGlobal.__controllers[0].__max += offset_x;
    scope.plane_clipping_x += offset_x;
    scope.folderGlobal.__controllers[0].updateDisplay();
    scope.folderGlobal.__controllers[0].setValue(scope.plane_clipping_x);

    scope.folderGlobal.__controllers[1].__min -= offset_y;
    scope.folderGlobal.__controllers[1].__max -= offset_y;
    scope.plane_clipping_y -= offset_y;
    scope.folderGlobal.__controllers[1].updateDisplay();
    scope.folderGlobal.__controllers[1].setValue(scope.plane_clipping_y);

    scope.folderGlobal.__controllers[2].__min += offset_z;
    scope.folderGlobal.__controllers[2].__max += offset_z;
    scope.plane_clipping_z += offset_z;
    scope.folderGlobal.__controllers[2].updateDisplay();
    scope.folderGlobal.__controllers[2].setValue(scope.plane_clipping_z);

    for (let obj of scope.selected_part_objs) {
        for (let mat of obj.material) {
            mat.color.setHex(scope.current_part_color);
        }
    }

    scope.current_remesh_obj = undefined;

    scope.renderer.setClearColor(new THREE.Color(scope.bg_color_normal));
    scope.on_window_resize();

    scope.threed_ui_state = 'part_select';
};


// compute the meta information for remeshed part
// will be used later for computing the shortest-path cut
PartAnnotator.prototype.compute_meta_information = function(mesh) {
    console.log('[compute_meta_information] enter');

    var geom = mesh.geometry;
    scope.map = [];
    scope.edge2faces = {};
    for (i = 0; i < geom.vertices.length; ++i) {
        scope.map[i] = [];
    }

    var get_edge_name = function(x, y) {
        if (x < y) return x+'-'+y; else return y+'-'+x;
    };

    var min_x = undefined, max_x = undefined;
    var min_y = undefined, max_y = undefined;
    var min_z = undefined, max_z = undefined;

    var small, big, edge, i, face, edge_dist;
    for (i = 0; i < geom.faces.length; ++i){
        face = geom.faces[i];

        edge = get_edge_name(face.a, face.b);
        if (edge in scope.edge2faces) {
            scope.edge2faces[edge].push(i);
        } else {
            scope.edge2faces[edge] = [i];
        }
        scope.map[face.a].push(face.b);
        scope.map[face.b].push(face.a);

        edge = get_edge_name(face.b, face.c);
        if (edge in scope.edge2faces) {
            scope.edge2faces[edge].push(i);
        } else {
            scope.edge2faces[edge] = [i];
        }
        scope.map[face.c].push(face.b);
        scope.map[face.b].push(face.c);

        edge = get_edge_name(face.a, face.c);
        if (edge in scope.edge2faces) {
            scope.edge2faces[edge].push(i);
        } else {
            scope.edge2faces[edge] = [i];
        }
        scope.map[face.a].push(face.c);
        scope.map[face.c].push(face.a);

        var vert = geom.vertices[face.a];
        if (min_x === undefined || min_x > vert.x) min_x = vert.x;
        if (max_x === undefined || max_x < vert.x) max_x = vert.x;
        if (min_y === undefined || min_y > vert.y) min_y = vert.y;
        if (max_y === undefined || max_y < vert.y) max_y = vert.y;
        if (min_z === undefined || min_z > vert.z) min_z = vert.z;
        if (max_z === undefined || max_z < vert.z) max_z = vert.z;
    }

    var shuffle = function(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    for (i = 0; i < geom.vertices.length; ++i) {
        shuffle(scope.map[i]);
    }

    console.log('[compute_meta_information] quit');

    return new THREE.Box3(new THREE.Vector3(min_x, min_y, min_z),
        new THREE.Vector3(max_x, max_y, max_z));
};


// toggle show/hide global shape as context during remeshed part cutting
PartAnnotator.prototype.remesh_toggle_show_global_shape_context = function() {
    scope.toggle_remesh_show_global = !scope.toggle_remesh_show_global;

    var selected_part_ids = [];
    for (let obj of scope.selected_part_objs) {
        selected_part_ids.push(obj.part_type+'-'+obj.part_id);
    }

    for (let child of scope.scene.children) {
        if (child.type === 'Mesh' && child.is_part_mesh && child.part_type !== 'remesh'
            && selected_part_ids.indexOf(child.part_type+'-'+child.part_id) < 0) {
            child.visible = scope.toggle_remesh_show_global;
        }
    };

    scope.render();
};


// -----------------------------------------------------------
//      MODULE: 3D UI: Draw Segmentation Boundaries
// -----------------------------------------------------------

// initialize for boundary segmentation
PartAnnotator.prototype.init_segmentation_boundary = function() {
    scope.current_segment_id = null;
    scope.boundary_segments = [];
};


// initialize a new segment (remove the current path/segment/boundary)
PartAnnotator.prototype.get_a_new_segment = function() {
    var new_segment = new Map();
    new_segment.clicked_vertex = [];
    new_segment.vertex_sphere = [];
    new_segment.segment = [];
    new_segment.segment_line = [];
    new_segment.segment_distance = [];
    return new_segment;
};

// find nearest vertex given a clicked face and a clicked point
PartAnnotator.prototype.FindNearestVertex = function(face, point) {
    var min_dist = 1000;
    var min_index = 0;
    var vertex;
    var geom = scope.current_remesh_obj.geometry;
    var count = 0;
    var min_vertex;
    var face_list = [face.a, face.b, face.c];
    for (var i = 0; i < 3; ++i){
        var vertex = face_list[i];
        var coord = geom.vertices[vertex];
        var dist = Math.pow(coord.x-point.x, 2)+Math.pow(coord.y-point.y, 2)+Math.pow(coord.z-point.z, 2);
        if (dist < min_dist){
            min_dist = dist;
            min_index = count;
            min_vertex = vertex;
        }
        count++;
    }
    return min_vertex;
};

// process point click
PartAnnotator.prototype.process_remesh_point_click = function() {
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(scope.mouse_x, scope.mouse_y), scope.camera);

    var intersects = raycaster.intersectObjects([scope.current_remesh_obj]);
    var intersect_id = 0;
    while (intersect_id < intersects.length) {
        var obj = intersects[intersect_id].object;
        var point = intersects[intersect_id].point;
        var under_clipping = (point.x + scope.plane_clipping_x >= 0) &&
            (-point.y + scope.plane_clipping_y >= 0) &&
            (point.z + scope.plane_clipping_z >= 0);
        console.log(under_clipping, point, scope.plane_clipping_x, scope.plane_clipping_y, scope.plane_clipping_z);
        if (obj instanceof THREE.Mesh && obj.is_part_mesh && obj.visible && under_clipping) {
            break;
        }
        ++intersect_id;
    }

    if (intersect_id < intersects.length) {
        // get the clicked face and vertex
        var nearest_vertex = scope.FindNearestVertex(intersects[intersect_id].face, intersects[intersect_id].point);
        var sphere = scope.render_single_point(nearest_vertex);
        sphere.vertex_id = nearest_vertex;

        // create a new boundary segment when nothing exists
        if (scope.boundary_segments.length === 0) {
            scope.boundary_segments[0] = scope.get_a_new_segment();
            scope.current_segment_id = 0;
        }

        var current_segment = scope.boundary_segments[scope.current_segment_id];
        console.log('current segment: '+scope.current_segment_id+'/'+scope.boundary_segments.length);

        // update the path each time when adding a new point
        // loop all the O(n) segment and find the best segment
        // to add the point by minimal distance sum change
        if (current_segment.clicked_vertex.length === 0) {

            current_segment.clicked_vertex[0] = nearest_vertex;
            current_segment.vertex_sphere[0] = sphere;
            current_segment.segment[0] = [];
            current_segment.segment_line[0] = undefined;
            current_segment.segment_distance[0] = 0;

        } else {

            var i, p1, p2, dj_res1, dj_res2, dist_diff, dj_dist1, dj_dist2;
            var min_i, min_dist=null, min_dist1, min_dist2, min_seg1, min_seg2;
            var all_dj_res = [];
            for (i = 0; i < current_segment.clicked_vertex.length; ++i) {
                p = current_segment.clicked_vertex.slice(i)[0];
                var dj_res = scope.dj_mesh_by_vertex(p, nearest_vertex);
                all_dj_res.push(dj_res);
            }
            for (i = 0; i < current_segment.clicked_vertex.length; ++i) {
                var dj_res1 = all_dj_res[i];
                dj_dist1 = dj_res1.length - 1;
                var dj_res2 = all_dj_res[(i+1)%current_segment.clicked_vertex.length];
                dj_dist2 = dj_res2.length - 1;
                dist_diff = dj_dist1 + dj_dist2 - current_segment.segment_distance[i];
                if (min_dist === null || min_dist > dist_diff) {
                    min_dist = dist_diff; min_i = i;
                    min_seg1 = dj_res1; min_seg2 = dj_res2;
                    min_dist1 = dj_dist1; min_dist2 = dj_dist2;
                }
            }

            current_segment.clicked_vertex.splice( min_i+1, 0, nearest_vertex);
            current_segment.vertex_sphere.splice(min_i+1, 0, sphere);
            current_segment.segment.splice(min_i, 1, min_seg1);
            current_segment.segment.splice(min_i+1, 0, min_seg2);
            current_segment.segment_distance.splice(min_i, 1, min_dist1);
            current_segment.segment_distance.splice(min_i+1, 0, min_dist2);

            if (current_segment.segment_line[min_i] !== undefined) {
                console.log(current_segment.segment_line[min_i]);
                for (let line_geom of current_segment.segment_line[min_i]) {
                    scope.scene.remove(line_geom);
                }
            }

            var line1 = scope.render_path(min_seg1);
            current_segment.segment_line.splice(min_i, 1, line1);
            var line2 = scope.render_path(min_seg2);
            current_segment.segment_line.splice(min_i+1, 0, line2);

        }
    }
};


// process point delete
PartAnnotator.prototype.process_remesh_point_delete = function() {
    if (scope.boundary_segments.length === 0) return;

    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(scope.mouse_x, scope.mouse_y), scope.camera);

    var current_segment = scope.boundary_segments[scope.current_segment_id];

    var intersects = raycaster.intersectObjects(current_segment.vertex_sphere);
    var intersect_id = 0;
    while (intersect_id < intersects.length) {
        var obj = intersects[intersect_id].object;
        var point = intersects[intersect_id].point;
        var under_clipping = (point.x + scope.plane_clipping_x >= 0) &&
            (-point.y + scope.plane_clipping_y >= 0) &&
            (point.z + scope.plane_clipping_z >= 0);
        if (obj instanceof THREE.Mesh && !obj.is_part_mesh && under_clipping) {
            break;
        }
        ++intersect_id;
    }

    if (intersect_id < intersects.length) {
        // get the clicked face and vertex
        var nearest_vertex = intersects[intersect_id].object.vertex_id;

        // delete a vertex and re-compute the shortest path
        if (current_segment.clicked_vertex.length === 1 && nearest_vertex === current_segment.clicked_vertex[0]) {
            scope.process_boundary_delete();
            return;
        }

        for (var i = 0; i < current_segment.clicked_vertex.length; ++i) {
            if (current_segment.clicked_vertex[i] ===  nearest_vertex) {

                var left_vertex = (current_segment.clicked_vertex.length+i-1) % current_segment.clicked_vertex.length;
                var right_vertex = (current_segment.clicked_vertex.length+i+1) % current_segment.clicked_vertex.length;

                var dj_res = scope.dj_mesh_by_vertex(current_segment.clicked_vertex[left_vertex], current_segment.clicked_vertex[right_vertex]);
                var dj_dist = dj_res.length  - 1;
                var line = scope.render_path(dj_res);

                current_segment.clicked_vertex.splice(i, 1);
                scope.scene.remove(current_segment.vertex_sphere[i]);
                current_segment.vertex_sphere.splice(i, 1);

                current_segment.segment.splice(left_vertex, 1, dj_res);
                current_segment.segment_distance.splice(left_vertex, 1, dj_dist);
                if (current_segment.segment_line[left_vertex] !== undefined) {
                    for (let line_geom of current_segment.segment_line[left_vertex]) {
                        scope.scene.remove(line_geom);
                    }
                }
                current_segment.segment_line.splice(left_vertex, 1, line);

                current_segment.segment.splice(i, 1);
                current_segment.segment_distance.splice(i, 1);
                if (current_segment.segment_line[i] !== undefined) {
                    for (let line_geom of current_segment.segment_line[i]) {
                        scope.scene.remove(line_geom);
                    }
                }
                current_segment.segment_line.splice(i, 1);

                scope.render();
            }
        }
    }
};

// highlight a segment (remove the current path/segment/boundary)
PartAnnotator.prototype.highlight_segment = function() {
    if (scope.current_segment_id !== null) {
        var current_segment = scope.boundary_segments[scope.current_segment_id];
        for (let point of current_segment.vertex_sphere) {
            point.material.color.set(scope.color_segment_highlight);
        }
        for (let lines of current_segment.segment_line) {
            for (let line_geom of lines) {
                line_geom.material.color.set(scope.color_segment_highlight);
            }
        }
        scope.render();
    }
};

// de-highlight a segment (remove the current path/segment/boundary)
PartAnnotator.prototype.de_highlight_segment = function() {
    if (scope.current_segment_id !== null) {
        var current_segment = scope.boundary_segments[scope.current_segment_id];
        for (let point of current_segment.vertex_sphere) {
            point.material.color.set(scope.color_segment_normal);
        }
        for (let lines of current_segment.segment_line) {
            for (let line_geom of lines) {
                line_geom.material.color.set(scope.color_segment_normal);
            }
        }
        scope.render();
    }
};

// process boundary delete (remove the current path/segment/boundary)
PartAnnotator.prototype.process_boundary_delete = function() {
    if (scope.boundary_segments.length ===0) {
        return;
    }

    // de-render all points
    var current_segment = scope.boundary_segments[scope.current_segment_id];
    for (let point of current_segment.vertex_sphere) {
        scope.scene.remove(point);
    }
    // de-render all lines
    for (let lines of current_segment.segment_line){
        if (lines !== undefined) {
            for (let line_geom of lines) {
                scope.scene.remove(line_geom);
            }
        }
    }

    scope.boundary_segments.splice(scope.current_segment_id, 1);
    if (scope.boundary_segments.length > 0) {
        scope.current_segment_id = 0;
        scope.highlight_segment();
    } else {
        scope.boundary_segments[0] = scope.get_a_new_segment();
        scope.current_segment_id = 0;
    }
    scope.render();
};

PartAnnotator.prototype.process_boundary_delete_all = function() {
    var t = scope.boundary_segments.length;
    for (var i = 0; i < t; ++i) {
        scope.current_segment_id = 0;
        scope.process_boundary_delete();
    }
    scope.init_segmentation_boundary();
};

// select previous segment
PartAnnotator.prototype.select_previous_segment = function() {
    if (scope.current_segment_id !== null && scope.current_segment_id > 0) {
        scope.de_highlight_segment();
        -- scope.current_segment_id;
        scope.highlight_segment();
    }
    console.log('seg id: '+scope.current_segment_id+'/'+scope.boundary_segments.length);
};

// select next segment
PartAnnotator.prototype.select_next_segment = function() {
    if (scope.current_segment_id !== null) {
        if (scope.boundary_segments[scope.current_segment_id].clicked_vertex.length > 0) {
            scope.de_highlight_segment();
            ++scope.current_segment_id;
            if (scope.current_segment_id === scope.boundary_segments.length) {
                scope.boundary_segments[scope.current_segment_id] = scope.get_a_new_segment();
            }
            scope.highlight_segment();
        }
    }
    console.log('seg id: '+scope.current_segment_id+'/'+scope.boundary_segments.length);
};

// compute shortest_path from source to destination
// assume edge weight all to be one
// just degrade to compute BFS
PartAnnotator.prototype.dj_mesh_by_vertex = function(source, destination) {
    var queue = [source];
    var visited = [];
    visited[source] = source;
    while (queue.length > 0) {
        var p = queue.shift();
        for (let x of scope.map[p]) {
            if (x === destination) {
                var res = [destination];
                var cur_p = p;
                while (visited[cur_p] !== cur_p) {
                    res.unshift(cur_p);
                    cur_p = visited[cur_p];
                }
                res.unshift(cur_p);
                return res;
            }
            if (visited[x] === undefined) {
                visited[x] = p;
                queue.push(x);
            }
        }
    }
};

// render a single point
PartAnnotator.prototype.render_single_point =  function(vertex) {
    var geom = scope.current_remesh_obj.geometry;
    console.log('[Render Point]: '+geom.vertices[vertex].x+', '+geom.vertices[vertex].y+', '+geom.vertices[vertex].z);
    var geometry = new THREE.SphereGeometry( scope.segment_sphere_radius*scope.radius_multiplier, 32, 32 );
    geometry.translate(geom.vertices[vertex].x, geom.vertices[vertex].y, geom.vertices[vertex].z);
    var material = new THREE.MeshPhongMaterial( {color: scope.color_segment_highlight} );
    var sphere = new THREE.Mesh( geometry, material );
    sphere.is_part_mesh = false;
    scope.scene.add( sphere );
    scope.render();
    return sphere;
};

// render a path
PartAnnotator.prototype.render_path = function(vertices_path) {

    var cylinderMesh = function(pointX, pointY) {
        var direction = new THREE.Vector3().subVectors(pointY, pointX);
        var orientation = new THREE.Matrix4();
        orientation.lookAt(pointX, pointY, new THREE.Object3D().up);
        orientation.multiply(new THREE.Matrix4().set(1, 0, 0, 0,
            0, 0, 1, 0,
            0, -1, 0, 0,
            0, 0, 0, 1));
        var edgeGeometry = new THREE.CylinderGeometry(scope.remesh_boundary_line_width*scope.radius_multiplier,
            scope.remesh_boundary_line_width*scope.radius_multiplier, direction.length(), 8, 1);
        var edge = new THREE.Mesh(edgeGeometry,
            new THREE.MeshBasicMaterial( { color: scope.color_segment_highlight }));
        edge.applyMatrix(orientation);
        // position based on midpoints - there may be a better solution than this
        edge.position.x = (pointY.x + pointX.x) / 2;
        edge.position.y = (pointY.y + pointX.y) / 2;
        edge.position.z = (pointY.z + pointX.z) / 2;
        return edge;
    }

    var geom = scope.current_remesh_obj.geometry;
    console.log('vertices_path: ', vertices_path);

    var lines = [];
    for (var i = 0; i < vertices_path.length - 1; ++i) {
        var new_line_mesh = cylinderMesh(geom.vertices[vertices_path[i]], geom.vertices[vertices_path[i+1]]);
        new_line_mesh.is_part_mesh = false;
        scope.scene.add(new_line_mesh);
        lines.push(new_line_mesh);
    }

    scope.render();
    return lines;
};


// -----------------------------------------------------------
//        MODULE: 3D UI: Remeshed Part Cutting
// -----------------------------------------------------------


// process part cutting
PartAnnotator.prototype.process_part_cut = function() {
    var geom = scope.current_remesh_obj.geometry;
    console.log('Cutting the remeshed part');

    // get a set of edges that are drawn by users
    scope.cut_edge_set = new Set();
    for (let segment of scope.boundary_segments) {
        var i, v1, v2, small, big, edge;
        for (let data of segment.segment) {
            for (i = 0; i < data.length - 1; ++i) {
                v1 = data[i];
                v2 = data[i+1];
                small = Math.min(v1, v2);
                big = Math.max(v1, v2);
                edge = small + '-' + big;
                scope.cut_edge_set.add(edge);
            }
        }
    }

    // find connected components
    scope.remesh_new_part_seg = [];
    for (var i = 0; i < geom.faces.length; ++i) {
        scope.remesh_new_part_seg[i] = 0;
    }

    var current_part_id = 0, q, cur, face, v1, v2, v3, edge_list;
    for (var i = 0; i < geom.faces.length; ++i) {
        if (scope.remesh_part_seg[i] === 0 && scope.remesh_new_part_seg[i] === 0) {
            ++ current_part_id;

            var get_edge_name = function(x, y) {
                if (x < y) return x+'-'+y; else return y+'-'+x;
            }

            q = [];
            console.log('start from: '+i+' '+current_part_id);
            q.push(i); scope.remesh_new_part_seg[i] = current_part_id;
            while (q.length > 0) {
                cur = q.shift();
                face = geom.faces[cur];
                v1 = face.a; v2 = face.b; v3 = face.c;
                edge_list = [get_edge_name(v1, v2), get_edge_name(v1, v3), get_edge_name(v2, v3)];
                for (let edge of edge_list) {
                    if (!scope.cut_edge_set.has(edge)) {
                        for (let item of scope.edge2faces[edge]) {
                            if (item !== cur && scope.remesh_part_seg[item] === 0 && scope.remesh_new_part_seg[item] === 0) {
                                q.push(item); scope.remesh_new_part_seg[item] = current_part_id;
                            }
                        }
                    }
                }
            }
        }
    }

    console.log('total part: '+current_part_id);

    scope.process_boundary_delete_all();

    // render all new parts in alpha mode and wait for user to pick one
    // render selected part cuts in solid mode
    // user can use mouse to hoover over a part and make it solid
    // press S/s to select one and only one part as the part cutting result
    scope.remesh_new_part_seg_color = [];
    for (var i = 0; i < current_part_id; ++i) {
        var r, g, b;
        while (true) {
            r = Math.floor(Math.random() * 256);
            g = Math.floor(Math.random() * 256);
            b = Math.floor(Math.random() * 256);

            diff = Math.abs(r-g) + Math.abs(r-b) + Math.abs(b-g);

            if (!(g < 70 && b < 70 && r > 200) && diff > 100) {
                break;
            }
        }

        scope.remesh_new_part_seg_color[i+1] = 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    for (var i = 0; i < geom.faces.length; ++i) {
        if (scope.remesh_part_seg[i] === 0) {
            geom.faces[i].color.set(scope.remesh_new_part_seg_color[scope.remesh_new_part_seg[i]]);
            geom.faces[i].materialIndex = 1;
        } else {
            geom.faces[i].color.set(scope.remesh_part_seg_color[scope.remesh_part_seg[i]]);
            geom.faces[i].materialIndex = 0;
        }
    }

    geom.colorsNeedUpdate = true;
    geom.groupsNeedUpdate = true;

    scope.render();

    scope.threed_ui_state = 'remesh_cut';
};

// deal with mouse hoover
PartAnnotator.prototype.part_cut_mouse_hoover = function () {
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(scope.mouse_x, scope.mouse_y), scope.camera);

    var intersects = raycaster.intersectObjects([scope.current_remesh_obj]);
    var intersect_id = 0;
    while (intersect_id < intersects.length) {
        var point = intersects[intersect_id].point;
        var under_clipping = (point.x + scope.plane_clipping_x >= 0) &&
            (-point.y + scope.plane_clipping_y >= 0) &&
            (point.z + scope.plane_clipping_z >= 0);
        if (intersects[intersect_id].object instanceof THREE.Mesh && under_clipping) {
            break;
        }
        ++intersect_id;
    }

    var select_seg_id = null;
    if (intersect_id < intersects.length) {
        select_seg_id = scope.remesh_new_part_seg[intersects[intersect_id].face.faceid];
    }

    var geom = scope.current_remesh_obj.geometry;
    for (var i = 0; i < geom.faces.length; ++i) {
        if (scope.remesh_part_seg[i] === 0) {
            if (scope.remesh_new_part_seg[i] === select_seg_id) {
                geom.faces[i].materialIndex = 0;
            } else {
                geom.faces[i].materialIndex = 1;
            }
        }
    }
    geom.groupsNeedUpdate = true;
    scope.render();
};

// undo the part selection hoover stage
PartAnnotator.prototype.undo_current_boundary_cut = function() {
    var geom = scope.current_remesh_obj.geometry;
    for (var i = 0; i < geom.faces.length; ++i) {
        if (scope.remesh_part_seg[i] === 0) {
            geom.faces[i].color.setHex(scope.default_part_color);
            geom.faces[i].materialIndex = 0;
        }
    };
    geom.colorsNeedUpdate = true;
    geom.groupsNeedUpdate = true;
    scope.render();

    scope.threed_ui_state = 'remesh_segment';
};

// process remesh part select
PartAnnotator.prototype.process_remesh_part_select = function() {
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(scope.mouse_x, scope.mouse_y), scope.camera);

    var intersects = raycaster.intersectObjects([scope.current_remesh_obj]);
    var intersect_id = 0;
    while (intersect_id < intersects.length) {
        var point = intersects[intersect_id].point;
        var under_clipping = (point.x + scope.plane_clipping_x >= 0) &&
            (-point.y + scope.plane_clipping_y >= 0) &&
            (point.z + scope.plane_clipping_z >= 0);
        if (intersects[intersect_id].object instanceof THREE.Mesh && under_clipping) {
            break;
        }
        ++intersect_id;
    }

    var select_seg_id = null;
    if (intersect_id < intersects.length && scope.remesh_part_seg[intersects[intersect_id].face.faceid] === 0) {
        select_seg_id = scope.remesh_new_part_seg[intersects[intersect_id].face.faceid];
    }

    if (select_seg_id !== null) {
        ++ scope.total_part_cut;
        var geom = scope.current_remesh_obj.geometry;
        var has_non_assigned_face = false;
        for (var i = 0; i < geom.faces.length; ++i) {
            if (scope.remesh_part_seg[i] === 0) {
                if (scope.remesh_new_part_seg[i] === select_seg_id) {
                    geom.faces[i].materialIndex = 0;
                    scope.remesh_part_seg[i] = scope.total_part_cut;
                    scope.remesh_part_seg_color[scope.total_part_cut] = scope.remesh_new_part_seg_color[select_seg_id];
                } else {
                    geom.faces[i].color.setHex(scope.default_part_color);
                    geom.faces[i].materialIndex = 0;
                    has_non_assigned_face = true;
                }
            }
        }
        geom.colorsNeedUpdate = true;
        geom.groupsNeedUpdate = true;
        scope.render();

        if (has_non_assigned_face) {
            scope.threed_ui_state = 'remesh_segment';
        } else {
            alert('You have generated ' + scope.total_part_cut + ' parts in total. ' +
                'To undo the last part cut, press U/u. To submit the results, press B/b again.');
            scope.threed_ui_state = 'remesh_final';
        }

    }
};


// process undo part cutting
PartAnnotator.prototype.process_part_cut_undo = function() {
    var geom = scope.current_remesh_obj.geometry;

    console.log('[Process Part Cut Undo]');

    if (scope.total_part_cut > 0) {
        for (var i = 0; i < geom.faces.length; ++i) {
            if (scope.remesh_part_seg[i] === scope.total_part_cut) {
                scope.remesh_part_seg[i] = 0;
                geom.faces[i].color.setHex(scope.default_part_color);
                geom.faces[i].materialIndex = 0;
            }
        }
        -- scope.total_part_cut;
    }

    geom.colorsNeedUpdate = true;
    geom.groupsNeedUpdate = true;

    scope.render();

    if (scope.threed_ui_state === 'remesh_final') {
        scope.threed_ui_state = 'remesh_segment';
    }
};


// -----------------------------------------------------------
//          MODULE: 3D UI: Submit Cutting Result
// -----------------------------------------------------------


// submit part cutting result
PartAnnotator.prototype.gen_last_part_cut_before_submission = function() {
    if (scope.total_part_cut === 0) {
        alert('You have not done any cut yet! Want to cancel the cutting, please M/m!');
        return;
    }

    var geom = scope.current_remesh_obj.geometry;
    var has_non_assigned_face = false;

    var r, g, b;
    while (true) {
        r = Math.floor(Math.random() * 256);
        g = Math.floor(Math.random() * 256);
        b = Math.floor(Math.random() * 256);

        diff = Math.abs(r-g) + Math.abs(r-b) + Math.abs(b-g);

        if (!(g < 70 && b < 70 && r > 200) && diff > 100) {
            break;
        }
    }

    var color = 'rgb(' + r + ',' + g + ',' + b + ')';

    for (var i = 0; i < geom.faces.length; ++i) {
        if (scope.remesh_part_seg[i] === 0) {
            has_non_assigned_face = true;
            scope.remesh_part_seg[i] = scope.total_part_cut + 1;
            geom.faces[i].color.set(color);
            geom.faces[i].materialIndex = 0;
        }
    }
    geom.colorsNeedUpdate = true;
    geom.groupsNeedUpdate = true;
    scope.render();

    var prefix = '';
    if (has_non_assigned_face) {
        prefix = 'We create a part for the unannotated region! ';
        ++scope.total_part_cut;
    }

    alert(prefix+'You have generated ' + scope.total_part_cut + ' parts in total. ' +
        'To undo the last part cut, press U/u. To submit the results, press B/b again.');

    scope.threed_ui_state = 'remesh_final';
};

// submit part cutting result
PartAnnotator.prototype.submit_part_cutting_result = function() {

    // submit the new cuts and replace the old part with the new cuts
    scope.submit_part_cutting_result_to_server();

    // set the camera back
    scope.on_window_resize();
};

// submit part cutting result back to server
// server will generate an obj for each new part
// and return them back for click-and-group
PartAnnotator.prototype.submit_part_cutting_result_to_server = function() {
    var url = be_config.remoteHost+':'+be_config.remotePort+be_config.submit_remesh+'/' +
        scope.anno_id+'-'+scope.current_remesh_obj.part_type+'-'+scope.current_remesh_obj.part_id;
    console.log(url);
    request(
        {
            method: 'POST',
            uri: url,
            headers: {
                'content-type': 'multipart/form-data',
            },
            multipart: {
                chunked: false,
                data:[
                    {
                        'Content-Disposition': 'form-data; name="data"',
                        'Content-Type': 'application/json',
                        body: JSON.stringify(scope.remesh_part_seg)
                    }
                ]
            },
        },

        function (error, response, body) {
            if (response.statusCode === 200) {
                scope.load_new_parts_from_remesh_cutting();
            }
        }

    );
};

// load_new_part_from_remesh_cutting
PartAnnotator.prototype.load_new_parts_from_remesh_cutting = function () {

    var file_path = be_config.remoteHost+':'+be_config.remotePort+be_config.get_remesh_cut_json+'/'+
        scope.anno_id+'-'+scope.current_remesh_obj.part_type+'-'+scope.current_remesh_obj.part_id;

    console.log('[Load Remesh Cut Output JSON]: loading from '+file_path);

    var xmlhttp = new XMLHttpRequest();

    xmlhttp.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
            var json = JSON.parse(this.responseText);

            // remove the old parts
            for (let item of scope.selected_part_objs) {
                scope.scene.remove(item);
            }
            scope.selected_part_objs = new Set();

            // go back to the part_select mode
            scope.undo_current_remeshing();

            // load the new parts
            for (let item of json) {
                scope.load_obj('new', item);
            }

            scope.render();
        }
    };

    xmlhttp.open("GET", file_path, true);
    xmlhttp.send();
};


// -----------------------------------------------------------
//         MODULE:  Part Hierarchy
// -----------------------------------------------------------

// init
PartAnnotator.prototype.part_hier_setup = function() {
    scope.switch_load_part_hier_template = false;
    scope.part_template_part_map = null;

    scope.part_hier_instance_tree = [];
    scope.part_hier_instance_selected_node = null;
    scope.my_id_to_json_node = [];
    scope.current_instance_node_my_id = 0;
    scope.myId2nodeId = [];
    scope.myId2isLeaf = [];
    scope.myId2partObjs = [];
};

// load existing instance tree annotation from json
PartAnnotator.prototype.process_load_parent_anno = function() {
    // load the current version
    var json_url = be_config.remoteHost+':'+be_config.remotePort+be_config.get_anno_json+'/'+scope.anno_id+'-'+scope.anno_version;
    
    document.getElementById("prompt").innerHTML = "Loading stored data! Please wait!";

    $.getJSON( json_url, function( data ) {
        console.log('Load parent anno:'+data);

        scope.part_hier_instance_tree = data;

        var recover_node = function(data) {
            console.log('[recovering] '+data.text);
            scope.current_instance_node_my_id = Math.max(scope.current_instance_node_my_id, data.my_id);
            scope.my_id_to_json_node[data.my_id] = data;
            console.log('set '+data.text+' '+data.my_id+' to '+JSON.stringify(data));
            if ('nodes' in data) {
                for (let subpart of data.nodes) {
                    recover_node(subpart);
                }
            }
            if ('parts' in data) {
                scope.myId2partObjs[data.my_id] = [];
                for (let obj of scope.scene.children) {
                    if (data.parts.includes(obj.part_type+'-'+obj.part_id)) {
                        scope.myId2partObjs[data.my_id].push(obj);
                        obj.assigned_color = data.color;
                        for (let mat of obj.material) {
                            mat.color.set(data.color);
                        }
                    }
                }
            }
        };

        for (let item of data) {
            recover_node(item);
        }

        ++ scope.current_instance_node_my_id;

        scope.visualize_instance_tree();
        scope.render();

        document.getElementById("prompt").innerHTML = "";

        // load q&a status
        scope.load_qa_json();
    });
};

// show the template hierarchy using
PartAnnotator.prototype.load_part_hier_template = function() {

    var file_path = '/part_hier_templates/' + scope.model_cat + '/' + scope.template_filename;

    $.getJSON(file_path, function(output) {

        // generate the part map using name as unique id
        scope.part_template_part_map = {};

        var result = output['content'];
        scope.part_template_root = output['root'];

        for (let item of result) {
            if (item.name in scope.part_template_part_map) {
                console.log('[ERROR load_part_hier_template] the template has duplicate key: ' + item.name);
                alert('System encounters error: [ERROR load_part_hier_template] the template has duplicate key: ' + item.name);
            } else {
                scope.part_template_part_map[item.name] = item;

                // check OR or AND node
                if ("subtype" in item && "parts" in item) {
                    console.log('[ERROR load_part_hier_template] the part ' + item.name + ' has both subtype and parts key!');
                    alert('System encounters error: [ERROR load_part_hier_template] the part ' + item.name + ' has both subtype and parts key!');
                }

                if ("subtypes" in item) {
                    scope.part_template_part_map[item.name].q_type = 'or';
                } else if ("parts" in item) {
                    scope.part_template_part_map[item.name].q_type = 'and';
                } else {
                    scope.part_template_part_map[item.name].q_type = 'leaf';
                }
            }
        }

        scope.switch_load_part_hier_template = true;
    });
};

// visualize part hier instance tree
PartAnnotator.prototype.visualize_instance_tree = function() {
    if (scope.part_hier_instance_selected_node !== null) {
        scope.de_highlight_annotated_subtree(scope.part_hier_instance_selected_node);
    }

    console.log('[visualize_instance_tree]', JSON.stringify(scope.part_hier_instance_tree));

    $('#tree_instance').treeview({data: scope.part_hier_instance_tree,
        showCheckbox: true,
        onNodeChecked: function(event, node) {
            console.log('[Node Checked] instance '+ node.my_id+ ' temp id: ' + node.name + ' ' + node.text);
            scope.my_id_to_json_node[node.my_id].state.checked = true;
            if (node.nodes === null || node.nodes === undefined || node.nodes.length === 0) {
                if (scope.myId2isLeaf[node.my_id]) {
                    if (node.my_id in scope.myId2partObjs) {
                        for (let obj of scope.myId2partObjs[node.my_id]) {
                            obj.visible = true;
                            delete obj.hidden;
                        }
                    }
                    scope.render();
                }
            } else {
                for (let sub_node of node.nodes) {
                    $('#tree_instance').treeview('checkNode', [sub_node.nodeId]);
                }
            }
        },
        onNodeUnchecked: function(event, node) {
            console.log('[Node Unchecked] instance '+ node.my_id+ ' temp id: ' + node.name + ' ' + node.text);
            scope.my_id_to_json_node[node.my_id].state.checked = false;
            if (node.nodes === null || node.nodes === undefined || node.nodes.length === 0) {
                if (scope.myId2isLeaf[node.my_id]) {
                    if (node.my_id in scope.myId2partObjs) {
                        for (let obj of scope.myId2partObjs[node.my_id]) {
                            obj.visible = false;
                            obj.hidden = true;
                        }
                    }
                    scope.render();
                }
            } else {
                for (let sub_node of node.nodes) {
                    $('#tree_instance').treeview('uncheckNode', [sub_node.nodeId]);
                }
            }
        },
        onNodeSelected: function(event, node) {
            scope.part_hier_instance_selected_node = node;

            // expand the entire path
            var cur_node = node;
            while (cur_node.nodeId !== undefined) {
                if (cur_node.state.expanded === false) {
                    $('#tree_instance').treeview('toggleNodeExpanded', [cur_node]);
                }
                cur_node = $('#tree_instance').treeview('getParent', cur_node);
            }

            // render the current question
            scope.current_question_id = node.my_id;
            scope.select_question_by_id();

            // highlight the sub-tree
            scope.highlight_annotated_subtree(node);

            console.log('&&&&&&&&&&&&&&  [Node Select] instance '+ node.my_id+ ' temp id: ' + node.name + ' ' + node.text);
            console.log('&&&&&&&&&&&&&&  [Node Select] question_stack: ', scope.question_stack);
            console.log('&&&&&&&&&&&&&&  [Node Select] current questions: ', scope.my_id_to_question);
            console.log('&&&&&&&&&&&&&&  [Node Select] current answers: ', scope.my_id_to_answer);
        },
        onNodeUnselected: function(even, node) {
            scope.part_hier_instance_selected_node = null;

            scope.part_select_init();
            scope.threed_ui_state = 'idle';

            // unselect the current question
            scope.unselect_question_by_id(node.my_id);

            // de-highlight the sub-tree
            scope.de_highlight_annotated_subtree(node);

            console.log('**************  [Node Unselect] instance '+ node.my_id+ ' temp id: ' + node.name + ' ' + node.text);
            console.log('**************  [Node Unselect] question_stack: ', scope.question_stack);
            console.log('**************  [Node Unselect] current questions: ', scope.my_id_to_question);
            console.log('**************  [Node Unselect] current answers: ', scope.my_id_to_answer);
        }
    });

    // get myId2nodeId
    scope.myId2nodeId = [];
    scope.myId2isLeaf = [];
    console.log('gen: '+scope.current_instance_node_my_id);
    for (var i = 0; i < scope.current_instance_node_my_id; ++i) {
        var node = $('#tree_instance').treeview('getNode', i);
        if (node.nodeId !== undefined) {
            scope.myId2nodeId[node.my_id] = node;
            scope.myId2isLeaf[node.my_id] = false;
            if (node.name === 'other_leaf') {
                scope.myId2isLeaf[node.my_id] = true;
            } else if ((node.name !== 'other') &&
                (!("subtypes" in scope.part_template_part_map[node.name])) &&
                (!("parts" in scope.part_template_part_map[node.name]))) {
                scope.myId2isLeaf[node.my_id] = true;
            }

            console.log(node.my_id + ' ' + scope.myId2isLeaf[node.my_id]);
        }
    }
};

// Add a part
PartAnnotator.prototype.part_hier_add_a_part = function(current_template_node, parent_ins_node_my_id) {

    console.log('[Part Hier Add A Part]: template '+current_template_node.name+' ('+current_template_node.label+') ' +
        'my_id: '+scope.current_instance_node_my_id);

    var new_node = {
        my_id: scope.current_instance_node_my_id,
        name: current_template_node.name,
        icon: 'glyphicon glyphicon-question-sign',
        state: {
            selected: false,
            checked: true
        }
    };

    if (current_template_node.name === 'other') {
        new_node.text = current_template_node.label + ' ('+scope.other_str+')';
    } else {
        new_node.text = current_template_node.label;
    }

    scope.my_id_to_json_node[scope.current_instance_node_my_id] = new_node;

    if (parent_ins_node_my_id === undefined) {
        scope.part_hier_instance_tree.push(new_node);
    } else if ('nodes' in scope.my_id_to_json_node[parent_ins_node_my_id]) {
        scope.my_id_to_json_node[parent_ins_node_my_id].nodes.push(new_node);
    } else {
        scope.my_id_to_json_node[parent_ins_node_my_id].nodes = [new_node];
    }

    scope.question_stack.push(scope.current_instance_node_my_id);
    console.log('question stack:', scope.question_stack);

    scope.prepare_new_question_by_id(scope.current_instance_node_my_id);

    ++ scope.current_instance_node_my_id;

    // render the instance tree
    scope.visualize_instance_tree();

    return scope.current_instance_node_my_id-1;
};


// Annotate a leaf part
PartAnnotator.prototype.part_hier_annotate_part = function(part_my_id) {
    var cur_json_node = scope.my_id_to_json_node[part_my_id];

    if (scope.selected_part_objs.size === 0) {
        alert('Please select some parts to assign to part '+cur_json_node.text);
        return false;
    }

    console.log('[part_hier_annotate_part] '+cur_json_node+' '+part_my_id);

    if ('parts' in cur_json_node) {
        alert('You have annotated the part '+cur_json_node.text);
        return false;
    } else {
        var selected_part_ids = [];
        for (let item of scope.selected_part_objs) {
            selected_part_ids.push(item.part_type+'-'+item.part_id);
        }
        cur_json_node.parts = Array.from(selected_part_ids);

        var r, g, b;
        while (true) {
            r = Math.floor(Math.random() * 256);
            g = Math.floor(Math.random() * 256);
            b = Math.floor(Math.random() * 256);

            diff = Math.abs(r-g) + Math.abs(r-b) + Math.abs(b-g);

            if (!(g < 70 && b < 70 && r > 200) && diff > 100) {
                break;
            }
        }

        var random_color = 'rgb(' + r + ',' + g + ',' + b + ')';

        var hex_color = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

        cur_json_node.color = hex_color;

        for (let obj of scope.selected_part_objs) {
            obj.assigned_color = random_color;
        }

        scope.myId2partObjs[part_my_id] = [];

        for (let obj of scope.selected_part_objs) {
            scope.myId2partObjs[part_my_id].push(obj);
        }

        scope.render();

        // render the instance tree
        scope.visualize_instance_tree();

        // expand the entire path
        var cur_node = scope.myId2nodeId[part_my_id];

        while (cur_node.nodeId !== undefined) {
            if (cur_node.state.expanded === false) {
                $('#tree_instance').treeview('toggleNodeExpanded', [cur_node]);
            }
            cur_node = $('#tree_instance').treeview('getParent', cur_node);
        }

        scope.part_hier_instance_selected_node = null;
    }

    return true;
};


// Delete a part (the entire sub-tree will be deleted)
PartAnnotator.prototype.part_hier_annotate_delete = function(part_my_id) {

    var current_question = scope.my_id_to_question[part_my_id];
    var current_answer = scope.my_id_to_answer[part_my_id];

    if (current_answer === undefined) {
        // if the part node is not annotated, just remove it from the question list
        var index = scope.question_stack.indexOf(part_my_id);
        console.log('[delete] index: ', index);
        if (index !== undefined) {
            scope.question_stack.splice(index, 1);
        }
    } else {
        scope.my_id_to_json_node[part_my_id].icon = 'glyphicon glyphicon-question-sign';
        delete scope.my_id_to_answer[part_my_id];

        // recursively delete all children annotation
        if (current_question.q_type === 'or' || current_question.q_type === 'and') {
            var cur_node = scope.my_id_to_json_node[part_my_id];
            for (let child_node of cur_node.nodes) {
                var success = scope.part_hier_annotate_delete(child_node.my_id);
                if (!success) {
                    return false;
                }
            }
            delete scope.my_id_to_json_node[part_my_id].nodes;
        } else if (current_question.q_type === 'leaf') {
            for (let obj of scope.myId2partObjs[part_my_id]) {
                for (let mat of obj.material) {
                    mat.color.setHex(scope.default_part_color);
                }
                if (obj.hidden) {
                    delete obj.hidden;
                    obj.visible = true;
                }
                obj.assigned_color = undefined;
            }
            delete scope.my_id_to_json_node[part_my_id].color;
            delete scope.my_id_to_json_node[part_my_id].parts;
            delete scope.myId2partObjs[part_my_id];
        } else {
            alert('System error. [part_hier_annotate_delete] unknown question type: '+current_question.q_type);
            return false;
        }
    }

    return true;
};

// Highlight the selected sub-tree
PartAnnotator.prototype.highlight_annotated_subtree = function(node) {
    console.log('highlight '+node.my_id+' '+node.text+' '+scope.myId2isLeaf[node.my_id]+' '+scope.myId2partObjs[node.my_id]);
    if (scope.myId2isLeaf[node.my_id]) {
        if (node.my_id in scope.myId2partObjs) {
            for (let obj of scope.myId2partObjs[node.my_id]) {
                for (let mat of obj.material) {
                    mat.color.setHex(scope.current_part_color);
                }
            }
        }
        scope.render();
    } else {
        if (node.nodes !== undefined) {
            for (let sub_node of node.nodes) {
                scope.highlight_annotated_subtree(sub_node);
            }
        }
    }
};

// De-Highlight the selected sub-tree
PartAnnotator.prototype.de_highlight_annotated_subtree = function(node) {
    if (scope.myId2isLeaf[node.my_id]) {
        if (node.my_id in scope.myId2partObjs) {
            for (let obj of scope.myId2partObjs[node.my_id]) {
                for (let mat of obj.material) {
                    mat.color.set(obj.assigned_color);
                }
            }
        }
        scope.render();
    } else {
        if (node.nodes !== undefined) {
            for (let sub_node of node.nodes) {
                scope.de_highlight_annotated_subtree(sub_node);
            }
        }
    }
};

// Unselect all parts
PartAnnotator.prototype.part_hier_unselect_all = function() {
    if (scope.part_hier_instance_selected_node !== undefined && scope.part_hier_instance_selected_node !== null) {
        console.log('unselect: '+scope.part_hier_instance_selected_node.text);
        scope.de_highlight_annotated_subtree(scope.part_hier_instance_selected_node);
        $('#tree_instance').treeview('unselectNode', scope.part_hier_instance_selected_node.nodeId);
    }
}

// Save the current result to server
PartAnnotator.prototype.part_hier_save = function() {
    var url = be_config.remoteHost+':'+be_config.remotePort+be_config.update_anno_version;
    console.log('[part_hier_save] Update version Id: ' + url);
    var update_json = {anno_id: scope.anno_id, anno_version: scope.anno_version};

    document.getElementById("prompt").innerHTML = "Saving results to server! Please Wait!";

    request(
        {
            method: 'POST',
            uri: url,
            headers: {
                'content-type': 'multipart/form-data',
            },
            multipart: {
                chunked: false,
                data:[
                    {
                        'Content-Disposition': 'form-data; name="data"',
                        'Content-Type': 'application/json',
                        body: JSON.stringify(update_json)
                    }
                ]
            },
        },

        function (error, response, body) {
            console.log(error);
            if (response.statusCode === 200) {
                console.log('successfully update anno version: ++version');
                ++ scope.anno_version;

                // save json
                var save_json_url = be_config.remoteHost+':'+be_config.remotePort+be_config.save_anno_json;
                console.log('[part_hier_save] Save json: ' + save_json_url);

                var out_json = {};
                out_json.data = JSON.stringify(scope.part_hier_instance_tree);
                out_json.time = scope.timerInstance.getTimeValues().toString();
                out_json.anno_id = scope.anno_id;
                out_json.anno_version = scope.anno_version;

                scope.timerInstance.reset();

                request(
                    {
                        method: 'POST',
                        uri: save_json_url,
                        headers: {
                            'content-type': 'multipart/form-data',
                        },
                        multipart: {
                            chunked: false,
                            data:[
                                {
                                    'Content-Disposition': 'form-data; name="data"',
                                    'Content-Type': 'application/json',
                                    body: JSON.stringify(out_json)
                                }
                            ]
                        },
                    },

                    function (error, response, body) {
                        if (response.statusCode === 200) {
                            console.log('successfully save the new json');

                            // save snapshot
                            var save_img_url = be_config.remoteHost+':'+be_config.remotePort+be_config.save_anno_snapshot;
                            console.log('[part_hier_save]: Save Snapshot ' + save_img_url);

                            var img_json = {};
                            scope.get_snapshot();

                            img_json.img = scope.snapshot;
                            img_json.anno_id = scope.anno_id;
                            img_json.anno_version = scope.anno_version;

                            request(
                                {
                                    method: 'POST',
                                    uri: save_img_url,
                                    headers: {
                                        'content-type': 'multipart/form-data',
                                    },
                                    multipart: {
                                        chunked: false,
                                        data:[
                                            {
                                                'Content-Disposition': 'form-data; name="data"',
                                                'Content-Type': 'application/json',
                                                body: JSON.stringify(img_json)
                                            }
                                        ]
                                    },
                                },

                                function (error, response, body) {
                                    if (response.statusCode === 200) {
                                        console.log('successfully save the new snapshot');

                                        // save obj_list
                                        var save_data_url = be_config.remoteHost+':'+be_config.remotePort+be_config.save_anno_obj_list;
                                        console.log('[part_hier_save]: Save anno obj list ' + save_data_url);

                                        var data_json = {};

                                        var cur_obj_list = scope.get_current_scene_obj_list();

                                        data_json.data = JSON.stringify(cur_obj_list);
                                        data_json.anno_id = scope.anno_id;
                                        data_json.anno_version = scope.anno_version;

                                        request(
                                            {
                                                method: 'POST',
                                                uri: save_data_url,
                                                headers: {
                                                    'content-type': 'multipart/form-data',
                                                },
                                                multipart: {
                                                    chunked: false,
                                                    data:[
                                                        {
                                                            'Content-Disposition': 'form-data; name="data"',
                                                            'Content-Type': 'application/json',
                                                            body: JSON.stringify(data_json)
                                                        }
                                                    ]
                                                },
                                            },

                                            function (error, response, body) {
                                                if (response.statusCode === 200) {
                                                    console.log('successfully save the obj file list');

                                                    // save qa data
                                                    var save_data_url = be_config.remoteHost+':'+be_config.remotePort+be_config.save_qa_data;
                                                    console.log('[part_hier_save]: Save anno qa data ' + save_data_url);

                                                    var data_json = {};

                                                    var data = scope.export_qa_data();

                                                    data_json.data = JSON.stringify(data);
                                                    data_json.anno_id = scope.anno_id;
                                                    data_json.anno_version = scope.anno_version;

                                                    request(
                                                        {
                                                            method: 'POST',
                                                            uri: save_data_url,
                                                            headers: {
                                                                'content-type': 'multipart/form-data',
                                                            },
                                                            multipart: {
                                                                chunked: false,
                                                                data:[
                                                                    {
                                                                        'Content-Disposition': 'form-data; name="data"',
                                                                        'Content-Type': 'application/json',
                                                                        body: JSON.stringify(data_json)
                                                                    }
                                                                ]
                                                            },
                                                        },

                                                        function (error, response, body) {
                                                            if (response.statusCode === 200) {
                                                                console.log('successfully save the qa file');
                                                                document.getElementById("prompt").innerHTML = '';
                                                                alert('Save Completed!');
                                                            }
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    }
                                }
                            );
                        }
                    }
                );
            }
        }
    );
};

PartAnnotator.prototype.save_first_snapshot = function() {
    // save snapshot
    document.getElementById("prompt").innerHTML = 'Saving the current snapshot!';

    var save_img_url = be_config.remoteHost+':'+be_config.remotePort+be_config.save_anno_snapshot;
    console.log('[part_hier_save]: Save Snapshot ' + save_img_url);

    var img_json = {};
    scope.get_snapshot();

    img_json.img = scope.snapshot;
    img_json.anno_id = scope.anno_id;
    img_json.anno_version = scope.anno_version;

    request(
        {
            method: 'POST',
            uri: save_img_url,
            headers: {
                'content-type': 'multipart/form-data',
            },
            multipart: {
                chunked: false,
                data:[
                    {
                        'Content-Disposition': 'form-data; name="data"',
                        'Content-Type': 'application/json',
                        body: JSON.stringify(img_json)
                    }
                ]
            },
        },

        function (error, response, body) {
            if (response.statusCode === 200) {
                console.log('successfully save the first snapshot');
                document.getElementById("prompt").innerHTML = '';

                // start q&a first question
                scope.part_hier_add_a_part(scope.part_template_part_map[scope.part_template_root], undefined);

                scope.render_new_question();
            }
        }
    );
};



// -----------------------------------------------------------
//         MODULE:  Q & A Annotation Flow
// -----------------------------------------------------------


PartAnnotator.prototype.qa_setup = function() {
    this.question_stack = [];
    this.my_id_to_question = {};
    this.my_id_to_answer = {};
    this.current_question_id = null;

    // for part definition
    this.activated_part_definition_div = null;
};

PartAnnotator.prototype.load_example_img_filelist = function() {
    var url = '/part_hier_templates/'+scope.model_cat+'/'+scope.all_example_img_filelist;
    console.log('[load_example_img_filelist]: loading from '+url);
    var xmlhttp = new XMLHttpRequest();
    scope = this;
    xmlhttp.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
            var data = JSON.parse(this.responseText);
            scope.example_img_filelist = {};
            for (let item of Object.keys(data)) {
                if (data[item] !== null && data[item] !== undefined && data[item].length > 0) {
                    scope.example_img_filelist[item] = data[item];
                }
            }
            console.log('[example_img_filelist] ', scope.example_img_filelist);
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
};

PartAnnotator.prototype.export_qa_data = function() {
    var res = {
        question_stack: scope.question_stack,
        my_id_to_question: scope.my_id_to_question,
        my_id_to_answer: scope.my_id_to_answer,
        current_question_id: scope.current_question_id
    };
    return res;
};

PartAnnotator.prototype.load_qa_json = function() {
    // load the current version
    var json_url = be_config.remoteHost+':'+be_config.remotePort+be_config.get_qa_data+'/'+scope.anno_id+'-'+scope.anno_version;

    document.getElementById("prompt").innerHTML = "Loading q&a data! Please wait!";

    $.getJSON( json_url, function( data ) {
        console.log('Load parent anno:'+data);
        scope.import_qa_data(data);
        document.getElementById("prompt").innerHTML = "";

        alert('Loading finished!');
    });
};

PartAnnotator.prototype.import_qa_data = function(data) {
    scope.question_stack = data.question_stack;
    scope.my_id_to_question = data.my_id_to_question;
    scope.my_id_to_answer = data.my_id_to_answer;
    scope.current_question_id = data.current_question_id;

    if (scope.current_question_id === null) {
        scope.render_new_question();
    } else if (scope.current_question_id < 0) {
        scope.render_end_slide();
    } else {
        scope.locate_question();
    }
};

PartAnnotator.prototype.render_or_question = function() {
    var current_question = scope.my_id_to_question[scope.current_question_id];
    console.log('[render_or_question] question: ', current_question);

    var part_text = current_question.part_text;
    var subtypes = current_question.children;
    var cur_my_id = current_question.id;

    output = '<div class="slide">' +
                '<div class="question" onmouseover="show_definition(null)"> What is the subtype for this <b>' +
                        part_text + '</b> Part</div>' +
                '<div class="answers">';

    var selected_subtype = undefined;
    var selected_other = undefined;
    var cur_star_rating = 5;
    var disabled = '';
    var low_conf_reason = '';
    if (scope.my_id_to_question[cur_my_id].star_rating !== undefined) {
        cur_star_rating = scope.my_id_to_question[cur_my_id].star_rating;
    }
    if (scope.my_id_to_question[cur_my_id].low_conf_reason !== undefined) {
        low_conf_reason = scope.my_id_to_question[cur_my_id].low_conf_reason;
    }
    if (scope.my_id_to_answer[cur_my_id] !== undefined) {
        selected_subtype = scope.my_id_to_answer[cur_my_id].subtype;
        selected_other = scope.my_id_to_answer[cur_my_id].other;
        $('#clear_answer').prop('disabled', false);
        disabled = 'disabled';
    } else {
        if (Object.keys(scope.part_template_part_map).indexOf(current_question.name) >= 0) {
            var default_subtype = scope.part_template_part_map[current_question.name].default_subtype;
            if (default_subtype !== undefined) {
                selected_subtype = default_subtype;
            }
        }
        $('#clear_answer').prop('disabled', true);
    }
    $('#edit_answer').prop('disabled', true);

    for (let subtype of subtypes) {
        var subtype_text = scope.part_template_part_map[subtype].name;
        if ("label" in scope.part_template_part_map[subtype]) {
            subtype_text = scope.part_template_part_map[subtype].label;
        }

        if (selected_subtype === subtype) {
            output += '<div><label onmouseover="show_definition(\''+subtype+'\')">' +
                '<input type="radio" tabindex="-1" name="radio_answer" id="'+subtype+'" checked '+disabled+'>' +
                subtype_text + '</label></div>';
        } else {
            output += '<div><label onmouseover="show_definition(\''+subtype+'\')">' +
                '<input type="radio" tabindex="-1" name="radio_answer" id="'+subtype+'" '+disabled+'>' +
                subtype_text + '</label></div>';
        }

        scope.gen_part_definiton(subtype, scope.current_question_id, false);
    }

    if (selected_other !== undefined) {
        output += '<div><label><input type="radio" name="radio_answer" id="other" checked '+disabled+'>' +
            scope.other_str+' </label></div>' +
            '<input type="text" tabindex="-1" name="other_text" id="other_text" value="'+selected_other+'" '+disabled+'>';
    } else {
        output += '<div><label><input type="radio" name="radio_answer" id="other" '+disabled+'>' +
            scope.other_str+' </label></div>' +
            '<input type="text" tabindex="-1" name="other_text" id="other_text" '+disabled+'>';
    }

    scope.gen_part_definiton('other', scope.current_question_id, false);

    output += '</div></div>';

    output += '<div><b>Your Confidence for the Answer:</b> ' +
        '<input id="rating-input" value="'+cur_star_rating+'", type="text" ' +
        'onchange="star_rating_onchange('+scope.current_question_id+')"></div>';

    output += '<div><b>The reason for low confidence:</b><textarea ' +
        'name="low_conf_reason" id="low_conf_reason" ' +
        'onchange="low_conf_reason_onchange('+scope.current_question_id+')">'+low_conf_reason+'</textarea></div>';

    $('#annotation_quiz').html(output);
};

PartAnnotator.prototype.process_or_answer = function() {
    var current_question = scope.my_id_to_question[scope.current_question_id];

    var subtypes = current_question.children;
    var subtype = undefined;
    for (let st of subtypes) {
        if (document.getElementById(st).checked) {
            subtype = st;
            break;
        }
    }

    if (subtype === undefined) {
        if (document.getElementById('other').checked) {
            if (document.getElementById('other_text').value === '') {
                alert('Please enter a valid name for the subtype to describe the part!');
                return false;
            } else {
                delete scope.my_id_to_json_node[current_question.id].icon;
                var other_node = {
                    name: 'other',
                    label: document.getElementById('other_text').value
                };
                var child_my_id = scope.part_hier_add_a_part(other_node, current_question.id);
                scope.my_id_to_answer[current_question.id] = {
                    q_type: 'or',
                    subtype: 'other',
                    other: document.getElementById('other_text').value,
                    star_rating: document.getElementById('rating-input').value,
                    low_conf_reason: document.getElementById('low_conf_reason').value,
                    children: [child_my_id]
                };
            }
        } else {
            alert('Please select a subtype! If you think none of the options is correct, please choose other and type in a valid name!');
            return false;
        }
    } else {
        if (document.getElementById('other_text').value === '') {
            delete scope.my_id_to_json_node[current_question.id].icon;
            var child_my_id = scope.part_hier_add_a_part(scope.part_template_part_map[subtype], current_question.id);
            scope.my_id_to_answer[current_question.id] = {
                q_type: 'or',
                subtype: subtype,
                star_rating: document.getElementById('rating-input').value,
                low_conf_reason: document.getElementById('low_conf_reason').value,
                children: [child_my_id]
            };
        } else {
            alert('You are choosing subtype '+subtype+'. Please do not specify a part for other!');
            return false;
        }
    }

    return true;
};

PartAnnotator.prototype.render_number_control_html = function(subpart, subpart_text, num_part, disabled) {
    output = `
        <div class="numbers-row">
            <button type="button" class="btn btn-default" onclick="number_button_dec('${subpart}');" ${disabled}>-</button>
            <input type="number" min="0" max="99" name="${subpart}" id="${subpart}" value="${num_part}" ${disabled}>
            <button type="button" class="btn btn-default" onclick="number_button_inc('${subpart}');" ${disabled}>+</button>
            <label onmouseover="show_definition('${subpart}');">${subpart_text}</label>
        </div>
    `;
    return output;
};

PartAnnotator.prototype.render_and_question = function() {
    var current_question = scope.my_id_to_question[scope.current_question_id];
    console.log('[render_and_question] question: ', current_question);

    var part_text = current_question.part_text;
    var subparts = current_question.children;
    var cur_my_id = current_question.id;

    output = '<div class="slide">' +
        '<div class="question" onmouseover="show_definition(null);"> What components does this <b>' +
        part_text + '</b> has? Select all that apply. Use <b> Other </b> to specify a part that is not listed.  </div>' +
        '<div class="answers">';

    var selected_subpart = {};
    var selected_other = [];
    var disabled = '';
    var cur_star_rating = 5;
    var low_conf_reason = '';
    if (scope.my_id_to_question[cur_my_id].star_rating !== undefined) {
        cur_star_rating = scope.my_id_to_question[cur_my_id].star_rating;
    }
    if (scope.my_id_to_question[cur_my_id].low_conf_reason !== undefined) {
        low_conf_reason = scope.my_id_to_question[cur_my_id].low_conf_reason;
    }
    if (scope.my_id_to_answer[cur_my_id] !== undefined) {
        selected_subpart = scope.my_id_to_answer[cur_my_id].subpart;
        selected_other = scope.my_id_to_answer[cur_my_id].other;
        if (scope.my_id_to_answer[cur_my_id].is_editting === undefined) {
            $('#edit_answer').prop('disabled', false);
            $('#clear_answer').prop('disabled', false);
            disabled = 'disabled';
        } else {
            $('#edit_answer').prop('disabled', true);
            $('#clear_answer').prop('disabled', true);
        }
    } else {
        if (Object.keys(scope.part_template_part_map).indexOf(current_question.name) >= 0) {
            var default_subpart_num = scope.part_template_part_map[current_question.name].default_part_num;
            if (default_subpart_num !== undefined) {
                for (var i = 0; i < default_subpart_num.length; ++i) {
                    selected_subpart[subparts[i]] = default_subpart_num[i];
                }
            }
        }
        $('#clear_answer').prop('disabled', true);
        $('#edit_answer').prop('disabled', true);
    }

    for (let subpart of subparts) {

        var subpart_text = undefined;
        if (subpart === 'other_leaf') {
            subpart_text = 'other_part (leaf_node)';
        } else {
            console.log(subpart);
            subpart_text = scope.part_template_part_map[subpart].label;
        }

        var num_part = 0;
        if (subpart in selected_subpart) {
            num_part = selected_subpart[subpart];
        }

        output += scope.render_number_control_html(subpart, subpart_text, num_part, disabled);

        scope.gen_part_definiton(subpart, scope.current_question_id, false);
    }

    var num_part = 0; var other_part_list = '';
    if ('other' in selected_subpart) {
        num_part = selected_subpart['other'];
        for (var i = 0; i< num_part; ++i) {
            var cur_name = 'other_part_'+i;
            other_part_list += '<div><input list="wordnet_words" type="text" name="'+cur_name+'" id="'+cur_name+'" ' +
                'value="'+selected_other[i]+'" '+disabled+'></div>';
        }
    }

    output += scope.render_number_control_html('other', scope.other_str, num_part, disabled);
    output +=  '<div id="other_part_list">' + other_part_list + '</div>'

    scope.gen_part_definiton('other', scope.current_question_id, false);

    output += '</div></div>';

    output += '<div><b>Your Confidence for the question:</b> ' +
        '<input id="rating-input" value="'+cur_star_rating+'", type="text" ' +
        'onchange="star_rating_onchange('+scope.current_question_id+')"></div>';

    output += '<div><b>The reason for low confidence:</b><textarea ' +
        'name="low_conf_reason" id="low_conf_reason" ' +
        'onchange="low_conf_reason_onchange('+scope.current_question_id+')">'+low_conf_reason+'</textarea></div>';

    $('#annotation_quiz').html(output);
};

PartAnnotator.prototype.process_and_answer = function() {
    var current_question = scope.my_id_to_question[scope.current_question_id];

    var subparts = current_question.children;
    var q_id = current_question.id;

    var result = {}; var tot_part = 0;
    for (let subpart of subparts) {
        var value = document.getElementsByName(subpart)[0].value;
        var value_int = parseInt(value);
        if (isNaN(value_int)) {
            alert('Value '+value+' is not integer!');
            return false;
        } else if (value_int < 0) {
            alert('Value '+value_int+' < 0!');
            return false;
        } else {
            result[subpart] = value_int;
            tot_part += value_int;
        }
    }

    // part "other"
    var result_other = [];
    var value = document.getElementsByName('other')[0].value;
    var value_int = parseInt(value);
    if (isNaN(value_int)) {
        alert('Value '+value+' is not integer!');
        return false;
    } else if (value_int < 0) {
        alert('Value '+value_int+' < 0!');
        return false;
    } else {
        result['other'] = value_int;
        tot_part += value_int;
        for (var i = 0; i < value_int; ++i) {
            if (document.getElementById('other_part_'+i).value === '') {
                alert('You need to enter the name for the part other!');
                return false;
            }
            result_other.push(document.getElementById('other_part_'+i).value);
        }
    }

    // check tot_part > 0
    if (tot_part === 0) {
        alert('Please specify a part! You are not selecting nothing!');
        return false;
    } else {
        scope.my_id_to_answer[q_id] = {
            q_type: 'and',
            subpart: result,
            other: result_other,
            star_rating: document.getElementById('rating-input').value,
            low_conf_reason: document.getElementById('low_conf_reason').value,
            children: []
        };
        delete scope.my_id_to_json_node[current_question.id].icon;

        for (let subpart of subparts) {
            for (var i = 0; i < result[subpart]; ++i) {
                if (subpart === 'other_leaf') {
                    var other_leaf_node = {
                        name: 'other_leaf',
                        label: scope.other_leaf_str
                    };
                    var child_my_id = scope.part_hier_add_a_part(other_leaf_node, q_id);
                    scope.my_id_to_answer[q_id].children.push(child_my_id);
                } else {
                    var child_my_id = scope.part_hier_add_a_part(scope.part_template_part_map[subpart], q_id);
                    scope.my_id_to_answer[q_id].children.push(child_my_id);
                }
            }
        }

        for (var i = 0; i< result['other']; ++i) {
            var other_node = {
                name: 'other',
                label: result_other[i]
            };
            var child_my_id = scope.part_hier_add_a_part(other_node, q_id);
            scope.my_id_to_answer[q_id].children.push(child_my_id);
        }
    }

    console.log('[process_and_answer] answer: ', scope.my_id_to_answer[q_id]);

    return true;
};

// edit and answer rules of principle
// if add more parts, no problem, just add more parts and add to question stack
// if delete parts, delete the unannotated ones
PartAnnotator.prototype.edit_and_answer = function() {
    console.log('[edit_and_answer] question_id: ', scope.current_question_id);
    console.log('[**** BEFORE updated answer] ', JSON.stringify(scope.my_id_to_answer[scope.current_question_id]));

    var current_question = scope.my_id_to_question[scope.current_question_id];

    var subparts = current_question.children;
    var q_id = current_question.id;

    var result = {}; var tot_part = 0;
    for (let subpart of subparts) {
        var value = document.getElementsByName(subpart)[0].value;
        var value_int = parseInt(value);
        if (isNaN(value_int)) {
            alert('Value '+value+' is not integer!');
            return false;
        } else if (value_int < 0) {
            alert('Value '+value_int+' < 0!');
            return false;
        } else {
            result[subpart] = value_int;
            tot_part += value_int;
        }
    }

    // part "other"
    var result_other = [];
    var value = document.getElementsByName('other')[0].value;
    var value_int = parseInt(value);
    if (isNaN(value_int)) {
        alert('Value '+value+' is not integer!');
        return false;
    } else if (value_int < 0) {
        alert('Value '+value_int+' < 0!');
        return false;
    } else {
        result['other'] = value_int;
        tot_part += value_int;
        for (var i = 0; i < value_int; ++i) {
            if (document.getElementById('other_part_'+i).value === '') {
                alert('You need to enter the name for the part other!');
                return false;
            }
            result_other.push(document.getElementById('other_part_'+i).value);
        }
    }

    // check tot_part > 0
    if (tot_part === 0) {
        alert('Please specify a part! You are not selecting nothing!');
        return false;
    } else {
        var answered_question_num = {}, unanswered_question_list = {}, name_to_text = {};
        for (let child_my_id of scope.my_id_to_answer[q_id].children) {
            var subpart_name = scope.my_id_to_question[child_my_id].name;
            if (subpart_name === 'other') {
                subpart_name = scope.my_id_to_question[child_my_id].part_text;
            }
            if (scope.my_id_to_answer[child_my_id] === undefined) {
                if (unanswered_question_list[subpart_name] === undefined) {
                    unanswered_question_list[subpart_name] = [];
                }
                unanswered_question_list[subpart_name].push(child_my_id);
            } else {
                if (answered_question_num[subpart_name] === undefined) {
                    answered_question_num[subpart_name] = 0;
                }
                ++ answered_question_num[subpart_name];
                name_to_text[subpart_name] = scope.my_id_to_question[child_my_id].part_text;
            }
        }

        var new_answer_question_num = {};
        for (let subpart of subparts) {
            if (result[subpart] > 0) {
                new_answer_question_num[subpart] = result[subpart];
            }
        }
        for (let part_name of result_other) {
            var other_part_name = part_name+' ('+scope.other_str+')';
            if (new_answer_question_num[other_part_name] === undefined) {
                new_answer_question_num[other_part_name] = 0;
            }
            ++ new_answer_question_num[other_part_name];
        }

        // check if valid
        var valid = true;
        for (let part_name of Object.keys(answered_question_num)) {
            if (answered_question_num[part_name] > 0 && (new_answer_question_num[part_name] === undefined ||
                    new_answer_question_num[part_name] < answered_question_num[part_name])) {
                var new_count = 0;
                if (new_answer_question_num[part_name] !== undefined) {
                    new_count = new_answer_question_num[part_name];
                }
                alert('Invalid editted answer: part "' + part_name + '" = ' + new_count + '. ' +
                    'You have annotate ' + answered_question_num[part_name] + ' part "' + name_to_text[part_name] + '" already. ' +
                    'Please delete them first!');
                valid = false;
                break;
            }
        }

        if (!valid) {
            return false;
        }

        // delete all old unanswered questions
        var deleted_node_my_ids = [];
        for (let part_name of Object.keys(unanswered_question_list)) {
            for (let part_id of unanswered_question_list[part_name]) {
                deleted_node_my_ids.push(part_id);
            }
        }

        // add new unanswered questions
        for (let part_name of Object.keys(new_answer_question_num)) {
            var more_count_tot = new_answer_question_num[part_name];
            if (answered_question_num[part_name] !== undefined) {
                more_count_tot -= answered_question_num[part_name];
            }
            for (var i = 0; i < more_count_tot; ++i) {
                var child_my_id;
                if (part_name.endsWith(' ('+scope.other_str+')')) {
                    var other_node = {
                        name: 'other',
                        label: part_name.split(' ')[0]
                    };
                    child_my_id = scope.part_hier_add_a_part(other_node, q_id);
                } else if (part_name === 'other_leaf') {
                    var other_leaf_node = {
                        name: 'other_leaf',
                        label: scope.other_leaf_str
                    };
                    child_my_id = scope.part_hier_add_a_part(other_leaf_node, q_id);
                } else {
                    child_my_id = scope.part_hier_add_a_part(scope.part_template_part_map[part_name], q_id);
                }
                scope.my_id_to_answer[q_id].children.push(child_my_id);
            }
        }

        var new_nodes = [];
        for (let child_node of scope.my_id_to_json_node[q_id].nodes) {
            if (deleted_node_my_ids.indexOf(child_node.my_id) < 0) {
                new_nodes.push(child_node);
            } else {
                var index = scope.question_stack.indexOf(child_node.my_id);
                if (index >= 0) {
                    scope.question_stack.splice(index, 1);
                }
                delete scope.my_id_to_question[child_node.my_id];
                var index = scope.my_id_to_answer[q_id].children.indexOf(child_node.my_id);
                if (index >= 0) {
                    scope.my_id_to_answer[q_id].children.splice(index, 1);
                }
            }
        }
        scope.my_id_to_json_node[q_id].nodes = new_nodes;

        // update the answer
        scope.my_id_to_answer[q_id].star_rating = document.getElementById('rating-input').value;
        scope.my_id_to_answer[q_id].low_conf_reason = document.getElementById('low_conf_reason').value;
        scope.my_id_to_answer[q_id].subpart = result;
        scope.my_id_to_answer[q_id].other = result_other;

        delete scope.my_id_to_answer[q_id].is_editting;

        console.log('[**** updated answer] ', JSON.stringify(scope.my_id_to_answer[q_id]));

        scope.visualize_instance_tree();
        scope.render();
    }

    return true;
};


PartAnnotator.prototype.render_leaf_question = function() {
    var current_question = scope.my_id_to_question[scope.current_question_id];
    console.log('[render_leaf_question] question: ', current_question);

    var part_text = current_question.part_text;
    var cur_my_id = current_question.id;

    output = '<div class="slide">' +
        '<div class="question" onmouseover="show_definition(null)"> Please annotation the part <b>' +
        part_text + '</b> from the right-hand-side 3D interface.</div></div>';

    var cur_star_rating = 5;
    var low_conf_reason = '';
    var disabled = '';
    if (scope.my_id_to_question[cur_my_id].star_rating !== undefined) {
        cur_star_rating = scope.my_id_to_question[cur_my_id].star_rating;
    }
    if (scope.my_id_to_question[cur_my_id].low_conf_reason !== undefined) {
        low_conf_reason = scope.my_id_to_question[cur_my_id].low_conf_reason;
    }
    if (scope.my_id_to_answer[cur_my_id] !== undefined) {
        $('#clear_answer').prop('disabled', false);
        disabled = 'disabled';
    } else {
        $('#clear_answer').prop('disabled', true);
        scope.threed_ui_state = 'part_select';
    }
    $('#edit_answer').prop('disabled', true);

    output += '<div><b>Your Confidence for the Answer:</b> ' +
        '<input id="rating-input" value="'+cur_star_rating+'", type="text" ' +
        'onchange="star_rating_onchange('+scope.current_question_id+')"></div>';

    output += '<div><b>The reason for low confidence:</b><textarea ' +
        'name="low_conf_reason" id="low_conf_reason"  ' +
        'onchange="low_conf_reason_onchange('+scope.current_question_id+')">'+low_conf_reason+'</textarea></div>';
    
    $('#annotation_quiz').html(output);
};

PartAnnotator.prototype.process_leaf_answer = function() {
    var success = scope.part_hier_annotate_part(scope.current_question_id);

    if (success) {
        scope.my_id_to_answer[scope.current_question_id] = {
            q_type: 'leaf',
            star_rating: document.getElementById('rating-input').value,
            low_conf_reason: document.getElementById('low_conf_reason').value
        };
        delete scope.my_id_to_json_node[scope.current_question_id].icon;
    } else {
        return false;
    }
    return true;
};


PartAnnotator.prototype.render_idle_question = function() {
    $('#annotation_quiz').html('<div class="slide"><div class="question">' +
        'Please select a question from the left part hierarchy to answer! ' +
        'Or press "Next Question" button for a new question suggested by the system.</div></div>');
    
    $('#clear_answer').prop('disabled', true);
    $('#edit_answer').prop('disabled', true);
    $('#next_question').prop('disabled', false);

    scope.threed_ui_state = 'idle';

    // unselect all tree nodes
    scope.part_hier_unselect_all();
    $('#part_definition').empty();
};

PartAnnotator.prototype.render_end_slide = function() {
    $('#annotation_quiz').html('<div class="slide"><div class="question">Congratulations! ' +
        'You have finished the annotation for this shape! ' +
        'Please double check the results! If it is as expected, ' +
        'please save the result and exit!</div></div>');

    $('#clear_answer').prop('disabled', true);
    $('#edit_answer').prop('disabled', true);
    $('#next_question').prop('disabled', true);

    scope.threed_ui_state = 'idle';

    // unselect all tree nodes
    scope.part_hier_unselect_all();
    $('#part_definition').empty();
};

PartAnnotator.prototype.prepare_new_question_by_id = function(cur_q_id) {
    var cur_node = scope.my_id_to_json_node[cur_q_id];
    var part_name = cur_node.name;

    console.log('[prepare_new_question_by_id] ', cur_node, part_name, cur_q_id);

    if (part_name === 'other') {

        var current_question = {
            q_type: 'and',
            part_text: cur_node.text,
            id: cur_q_id,
            name: 'other',
            children: ['other_leaf']
        };
    } else if (part_name === 'other_leaf') {

        var current_question = {
            q_type: 'leaf',
            part_text: cur_node.text,
            name: 'other_leaf',
            id: cur_q_id
        };
    } else {

        var q_type = scope.part_template_part_map[part_name].q_type;

        var current_question = {
            q_type: q_type,
            part_text: cur_node.text,
            name: part_name,
            id: cur_q_id
        };

        if (q_type === 'or') {
            current_question.children = scope.part_template_part_map[part_name].subtypes;
        } else if (q_type === 'and') {
            current_question.children = scope.part_template_part_map[part_name].parts;
        } else if (q_type === 'leaf') {

        } else {
            alert('System error. [render_question] Unknown question type: ' + q_type);
        }
    }

    scope.my_id_to_question[cur_q_id] = current_question;
};

PartAnnotator.prototype.render_new_question = function() {
    console.log('[render_new_question] stack: ', scope.question_stack);
    if (scope.question_stack.length > 0) {
        var cur_q_id = scope.question_stack.pop();
        scope.current_question_id = cur_q_id;
        scope.locate_question();
    } else {
        scope.current_question_id = -1;
        scope.render_end_slide();
    }
};

PartAnnotator.prototype.render_question = function() {
    var current_question = scope.my_id_to_question[scope.current_question_id];
    console.log('[render_question] question', scope.current_question_id, JSON.stringify(scope.my_id_to_question));
    var q_type = current_question.q_type;

    scope.threed_ui_state = 'idle';
    scope.part_select_init();

    // generate part definition
    $('#part_definition').empty();
    scope.gen_part_definiton(current_question.name, scope.current_question_id, true);

    // render or/and/leaf node question
    if (q_type === 'or') {
        scope.render_or_question();
    } else if (q_type === 'and') {
        scope.render_and_question();
    } else if (q_type === 'leaf') {
        scope.render_leaf_question();
    } else {
        alert('System error. [render_question] Unknown question type: '+q_type);
    }

    var star_caps = {0: 'I can\'t label!', 1: 'Very Unsure', 2: 'Unsure', 3: 'It\'s OK!', 4: 'Confident', 5: "Very Confident"};

    // set up for the star rating
    $('#rating-input').rating({
        min: 0,
        max: 5,
        step: 1,
        size: 'sm',
        showClear: false,
        starCaptions: star_caps
    });

    $('#next_question').prop('disabled', false);
};

PartAnnotator.prototype.next_question = function() {
    if (scope.current_question_id >=0 && (scope.my_id_to_answer[scope.current_question_id] === undefined ||
            scope.my_id_to_answer[scope.current_question_id].is_editting)) {
        if (scope.question_submit_answer()) {
            scope.render_new_question();
        }
    } else {
        scope.render_new_question();
    }
};

PartAnnotator.prototype.question_submit_answer = function() {
    console.log('[question_submit_answer] question: ', scope.my_id_to_question[scope.current_question_id]);
    var current_question = scope.my_id_to_question[scope.current_question_id];

    var success = true;

    if (current_question.q_type === 'or') {
        success = scope.process_or_answer();
    } else if (current_question.q_type === 'and') {
        console.log('[question_submit_answer AND] '+scope.current_question_id, scope.my_id_to_answer[scope.current_question_id]);
        if (scope.my_id_to_answer[scope.current_question_id] !== undefined &&
            scope.my_id_to_answer[scope.current_question_id].is_editting) {
                success = scope.edit_and_answer();
        } else {
                success = scope.process_and_answer();
        }
    } else if (current_question.q_type === 'leaf') {
        success = scope.process_leaf_answer();
    } else {
        alert('System error. [next_question] Unknown question type: '+current_question.q_type);
    }

    scope.visualize_instance_tree();

    if (!success) {
        scope.locate_question();
    }

    return success;
};

PartAnnotator.prototype.question_clear_answer = function() {
    var prompt_str = 'Are you sure you want to clear the answer to this question? ' +
        'All annotation for this question and the related questions in the sub-tree will be deleted!';
    
    if (confirm(prompt_str)) {
        if (scope.part_hier_annotate_delete(scope.current_question_id)) {
            scope.visualize_instance_tree();
            scope.render();
            scope.locate_question();
        }
    }
};

PartAnnotator.prototype.question_edit_answer = function() {
    var current_question = scope.my_id_to_question[scope.current_question_id];

    if (current_question.q_type === 'and') {
        scope.my_id_to_answer[scope.current_question_id].is_editting = true;
        scope.render_question();
    } else {
        alert('System error. [question_edit_answer] Unknown question type: '+current_question.q_type);
    }
};

PartAnnotator.prototype.select_question_by_id = function() {
    var index = scope.question_stack.indexOf(scope.current_question_id);
    if (index >= 0) {
        scope.question_stack.splice(index, 1);
    }
    scope.render_question();
};

PartAnnotator.prototype.unselect_question_by_id = function(cur_my_id) {
    if (scope.my_id_to_answer[cur_my_id] === undefined) {
        var index = scope.question_stack.indexOf(cur_my_id);
        if (index < 0) {
            scope.question_stack.push(cur_my_id);
            console.log('[unselect_question_by_id] ', scope.question_stack);
        }
    } else {
        if (scope.my_id_to_answer[cur_my_id].is_editting) {
            delete scope.my_id_to_answer[cur_my_id].is_editting;
        }
    }
    scope.current_question_id = -2;
    scope.render_idle_question();
};

PartAnnotator.prototype.locate_question = function() {
    var node = scope.myId2nodeId[scope.current_question_id];
    console.log('[locate_question] ', scope.current_question_id, node);
    $('#tree_instance').treeview('selectNode', [node]);
};

PartAnnotator.prototype.gen_part_definiton = function(part_name, parent_my_id, visible) {

    console.log('[gen_part_definiton] part_name: ', part_name, ' parent_my_id: ', parent_my_id);

    var visible_mode = 'none';
    var id_name = 'part_definition_'+part_name;
    if (visible) {
        visible_mode = 'block';
        id_name = 'part_definition_default';
        scope.activated_part_definition_div = '#part_definition_default';
    }

    var label_str = 'Label', gloss_str = 'Definition', name_str = 'Part Name';

    var output = '<div id="'+id_name+'" style="display:'+visible_mode+';">';
    if (part_name in scope.part_template_part_map) {
        output += '<h4>'+name_str+': '+part_name+'</h4>';

        var record = scope.part_template_part_map[part_name];
        if ('label' in record) {
            output += '<h4>'+label_str+': '+record.label+'</h4>';
        }
        if ('gloss' in record) {
            output += '<p><b>'+gloss_str+':</b> '+record.gloss+'</p>';
        }

        // get parent history
        var parent_history = [part_name];
        var cur_node = scope.myId2nodeId[parent_my_id]
        while (cur_node.nodeId !== undefined) {
            parent_history.unshift(cur_node.name);
            cur_node = $('#tree_instance').treeview('getParent', cur_node);
        }

        // get img from the current part_name
        for (var i = parent_history.length; i >= 0; --i) {
            var cur_path = parent_history.slice(0, i).join('/');
            if (Object.keys(scope.example_img_filelist).indexOf(cur_path) >= 0) {
                for (let item of scope.example_img_filelist[cur_path]) {
                    var img_url = '/part_hier_templates/'+scope.model_cat+'/'+scope.img_dir+'/'+cur_path+'/'+item;
                    output += '<a href="' + img_url + '" target="_blank">' +
                        '<img src="' + img_url + '" width="80%" style="max-width:100%; max-height:100%;"/></a>';
                }
                break;
            }
        }
    }

    output += '</div>';

    $('#part_definition').append(output);
};


// export the part_annotator object
window.PartAnnotator = PartAnnotator;


// -----------------------------------------------------------
//        MODULE: Some global helper functions
// -----------------------------------------------------------


window.number_button_inc = function(subpart) {
    console.log('number_button_inc: ', subpart, document.getElementsByName(subpart));
    var value = document.getElementsByName(subpart)[0].value;
    var value_int = parseInt(value);
    document.getElementsByName(subpart)[0].value = value_int+1;

    if (subpart === 'other') {
        adjust_other_number(subpart, 1);
    }
};

window.number_button_dec = function(subpart) {
    console.log('number_button_dec: ', subpart, document.getElementsByName(subpart));
    var value = document.getElementsByName(subpart)[0].value;
    var value_int = parseInt(value);
    if (value_int > 0) {
        document.getElementsByName(subpart)[0].value = value_int - 1;
    }

    if (subpart === 'other') {
        adjust_other_number(subpart, -1);
    }
};

window.adjust_other_number = function(subpart, add) {
    var value = document.getElementsByName(subpart)[0].value;
    if (add > 0) {
        console.log('add one other', value-1);
        $('#other_part_list').append('<div><input list="wordnet_words" name="other_part_"'+(value-1)+'" id="other_part_'+(value-1)+'" /></div>');
    } else {
        console.log('del one other', value);
        $('#other_part_'+value).parent().remove();
    }
};

window.show_definition = function(subpart) {
    console.log('[show_definition]', subpart);

    if (scope.activated_part_definition_div !== null && scope.activated_part_definition_div !== undefined) {
        $(scope.activated_part_definition_div).hide();
    }

    if (subpart === null) {
        $('#part_definition_default').show();
        scope.activated_part_definition_div = '#part_definition_default';
    } else {
        $('#part_definition_' + subpart).show();
        scope.activated_part_definition_div = '#part_definition_' + subpart;
    }
};

window.star_rating_onchange = function(q_id) {
    if (scope.my_id_to_question[q_id] !== undefined) {
        scope.my_id_to_question[q_id].star_rating = document.getElementById('rating-input').value;
    }
};

window.low_conf_reason_onchange = function(q_id) {
    if (scope.my_id_to_question[q_id] !== undefined) {
        scope.my_id_to_question[q_id].low_conf_reason = document.getElementById('low_conf_reason').value;
    }
};
