var be_config = require('./config/backend.js');
var request = require('request');
var FormData = require('form-data');

var scope;

var TemplateViewer = function(params) {

    this.category_id = params.category_id;

    console.log('Category Id: ', this.category_id);

    scope = this;

    scope.img_dir = 'imgs';
    scope.template_filename = 'template.json';
    scope.all_example_img_filelist = 'all_example_img_filelist.json';

    // load example img filelist
    scope.load_example_img_filelist();
};

TemplateViewer.prototype.load_example_img_filelist = function() {
    var url = '/part_hier_templates/'+scope.category_id+'/'+scope.all_example_img_filelist;
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


TemplateViewer.prototype.start = function () {
	
	// load part hier
    scope.load_part_hier_template();
};

// show the template hierarchy using
TemplateViewer.prototype.load_part_hier_template = function() {

    var file_path = '/part_hier_templates/' + scope.category_id + '/' + scope.template_filename;

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

        // build up the tree
        scope.part_hier_instance_tree = [];
        scope.part_names_with_history = [];
        scope.my_id_to_node = [];
        scope.current_my_id = 0;
        scope.myId2nodeId = [];

        scope.template_add_part(scope.part_template_root, undefined);

        scope.visualize_instance_tree();

        //$('#tree_instance').treeview('expandAll', { silent: true });
    });
};

TemplateViewer.prototype.template_add_part = function(cur_part, parent_my_id) {
    
    console.log('[Template Add Part] ', cur_part);

    var lang_q_type = scope.part_template_part_map[cur_part].q_type;

    var new_node = {
        name: cur_part,
        my_id: scope.current_my_id,
        text: '['+lang_q_type+'] '+scope.part_template_part_map[cur_part].label,
        state: {
            selected: false,
            checked: false
        }
    };

    scope.my_id_to_node[scope.current_my_id] = new_node;

    scope.current_my_id += 1;

    if (parent_my_id === undefined) {
        scope.part_hier_instance_tree.push(new_node);
    } else {
        if ('nodes' in scope.my_id_to_node[parent_my_id]) {
            scope.my_id_to_node[parent_my_id].nodes.push(new_node);
        } else {
            scope.my_id_to_node[parent_my_id].nodes = [new_node];   
        }
    }

    if (scope.part_template_part_map[cur_part].q_type === 'or') {
        for (let subitem of scope.part_template_part_map[cur_part].subtypes) {
            scope.template_add_part(subitem, new_node.my_id);
        }
    }

    if (scope.part_template_part_map[cur_part].q_type === 'and') {
        for (let subitem of scope.part_template_part_map[cur_part].parts) {
            scope.template_add_part(subitem, new_node.my_id);
        }
    }
};

// visualize part hier instance tree
TemplateViewer.prototype.visualize_instance_tree = function() {
    
    console.log('[visualize_instance_tree]', JSON.stringify(scope.part_hier_instance_tree));

    $('#tree_instance').treeview({data: scope.part_hier_instance_tree,
        onNodeSelected: function(event, node) {
            scope.gen_part_definition(node);
        },
        onNodeUnselected: function(event, node) {
           $('#part_definition').empty(); 
        }
    });

    // get myId2nodeId
    scope.myId2nodeId = [];
    for (var i = 0; i < scope.current_my_id; ++i) {
        var node = $('#tree_instance').treeview('getNode', i);
        if (node.nodeId !== undefined) {
            scope.myId2nodeId[node.my_id] = node;
            console.log(node.my_id + ' ' + scope.myId2nodeId[node.my_id]);
        }
    }
};

TemplateViewer.prototype.gen_part_definition = function(node) {

    console.log(JSON.stringify(node));

    var part_name = node.name;
    var output = '<div style="display:block;"><h4>Part name: '+part_name+'</h4>';

    if (part_name in scope.part_template_part_map) {
        var record = scope.part_template_part_map[part_name];
        if ('label' in record) {
            output += '<h4>Label: '+record.label+'</h4>';
        }
        if ('gloss' in record) {
            output += '<p><b>Definition:</b> '+record.gloss+'</p>';
        }

        // get parent history
        var parent_history = [];
        var cur_node = node;
        while (cur_node.nodeId !== undefined) {
            parent_history.unshift(cur_node.name);
            cur_node = $('#tree_instance').treeview('getParent', cur_node);
        }

        // get img from the current part_name
        for (var i = parent_history.length; i >= 0; --i) {
            var cur_path = parent_history.slice(0, i).join('/');
            console.log('cur_path: ', cur_path);
            console.log(Object.keys(scope.example_img_filelist));
            if (Object.keys(scope.example_img_filelist).indexOf(cur_path) >= 0) {
                for (let item of scope.example_img_filelist[cur_path]) {
                    var img_url = '/part_hier_templates/'+scope.category_id+'/'+scope.img_dir+'/'+cur_path+'/'+item;
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


// export the template_viewer object
window.TemplateViewer = TemplateViewer;

