window.post = function(path, params, method) {
    method = method || "post"; // Set method to post by default if not specified.

    // The rest of this code assumes you are not using a library.
    // It can be made less wordy if you use one.
    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);
    form.setAttribute("target", "_blank");

    for (var key in params) {
        if (params.hasOwnProperty(key)) {
            var hiddenField = document.createElement("input");
            hiddenField.setAttribute("type", "hidden");
            hiddenField.setAttribute("name", key);
            hiddenField.setAttribute("value", params[key]);

            form.appendChild(hiddenField);
        }
    }

    document.body.appendChild(form);
    form.submit();
};

window.label_new_model = function (username) {

    var cat_name = document.getElementById('select_cat_name').value;

    console.log('[label new model] start! class: ', cat_name);
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            console.log('[label new model] redirect post!');
            if (this.responseText === 'All-done') {
                alert('No new model to annotate for now!');
            } else if (this.responseText === 'Failed') {
                alert('Some error occurs from server!');
            } else {
                post('/part_annotator', {anno_id: this.responseText, allow_edit: true});
            }
        }
    };
    xmlhttp.open("GET", '/annotation/get_new_model/'+cat_name+'-'+username, true);
    xmlhttp.send();
};

window.load_cat_names = function() {
    console.log('[load_cat_names] start!');

    var keys = ['Bag', 'Bed', 'Bottle', 'Bowl', 'Chair', 'Clock', 'Dishwasher', 'Display', 'Door', 'Earphone', 
        'Faucet', 'Hat', 'Keyboard', 'Knife', 'Lamp', 'Laptop', 'Microwave', 'Mug', 'Refrigerator', 'Scissors', 
        'StorageFurniture', 'Table', 'TrashCan', 'Vase'];

    keys.forEach(function(item) {
        var option = document.createElement('option');
        option.value = item;
        option.text = item;
        $('#select_cat_name').append(option);
    });
};

window.label_new_model_by_id = function(username) {
    console.log('[label new model by id] start!');
    var modelid = prompt("Please enter the model id", "Example: c7ae4cc12a7bc2581fa16f9a5527bb27");
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
            console.log('[label new model by id] redirect post!');
            post('/part_annotator', {anno_id: this.responseText, allow_edit: true});
        } else if (this.readyState === 4 && this.status === 400){
            if (this.responseText === 'No-model') {
                alert('Bad Model ID name!');
            }
        }
    };
    xmlhttp.open("GET", '/annotation/get_new_model_by_id/'+username+'-'+modelid, true);
    xmlhttp.send();
};

window.gen_visu_list = function(username) {
    var table = document.getElementById("myTable").getElementsByTagName('tbody')[0];
    var cat_name = document.getElementById('select_cat_name').value;

    if ($.fn.DataTable.isDataTable("#myTable")) {
        $('#myTable').DataTable().clear().destroy();
    }

    table.innerHTML = '';

    $.getJSON('annotation/get_all_annotations/'+username+'/'+cat_name, function(data) {
        console.log('hahaha');
        for (let item of data.anno_list) {
            var anno_id = item.anno_id;
            var model_id = item.model_id;
            var anno_version = item.version;

            var row = table.insertRow(-1);

            row.insertCell(0).innerHTML = anno_id;
            row.insertCell(1).innerHTML = anno_version;
            row.insertCell(2).innerHTML = model_id;

            var img_html = '<img src="annotation/get_snapshot/' + anno_id + '-' + anno_version + '"></img>';
            row.insertCell(3).innerHTML = img_html;

            var view_html = '<button type="button" onclick="view_model(\''+anno_id+'\', \'en\')">View</button>';
            row.insertCell(4).innerHTML = view_html;

            var modify_html = '<button type="button" onclick="modify_model(\''+anno_id+'\', \'en\')">Modify</button>';
            row.insertCell(5).innerHTML = modify_html;

            var delete_html = '<button type="button" onclick="delete_model(\''+anno_id+'\', \''+username+'\', \'en\')">Delete</button>';
            row.insertCell(6).innerHTML = delete_html;

        }

        $('#myTable').DataTable({"aaSorting": [[ 0, "desc" ]],
            createdRow: function( row, data, dataIndex ) {
                if ( data[1] == "0" ) {
                    $(row).addClass('highlightRow'); 
                }
            }
        });
    });
};

window.view_model = function(anno_id) {
    post('/part_annotator', {anno_id: anno_id, allow_edit: false, load_parent_anno: true});
};

window.modify_model = function(anno_id) {
    post('/part_annotator', {anno_id: anno_id, allow_edit: true, load_parent_anno: true});
};

window.delete_model = function(anno_id, username) {
    var prompt_str, alert_str;
    prompt_str = 'Are you sure to delete this annotation? All the annotation for this shape will be deleted!';
    alert_str = 'Record Deleted! This page will be refreshed automatically!';
    if (confirm(prompt_str)) {
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                console.log('anno deleted: ' + anno_id);
                alert(alert_str);
                gen_visu_list(username);
            }
        };
        xmlhttp.open("GET", 'annotation/delete/' + anno_id, true);
        xmlhttp.send();
    }
};

window.view_template = function() {
    console.log('View template');
    var cat_name = document.getElementById('select_cat_name').value;
    window.open('/template_viewer/'+cat_name);
};
