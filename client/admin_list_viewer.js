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

window.gen_visu_list = function() {
    var table = document.getElementById("myTable").getElementsByTagName('tbody')[0];
    var cat_name = document.getElementById('select_cat_name').value;

    if ($.fn.DataTable.isDataTable("#myTable")) {
        $('#myTable').DataTable().clear().destroy();
    }    

    table.innerHTML = '';

    $.getJSON('annotation/get_all_annotations_admin/'+cat_name, function(data) {
        for (let item of data.anno_list) {
            var anno_id = item.anno_id;
            var model_id = item.model_id;
            var anno_version = item.version;
            var user_id = item.user_id;

            var row = table.insertRow(-1);

            row.insertCell(0).innerHTML = anno_id;
            row.insertCell(1).innerHTML = anno_version;

            row.insertCell(2).innerHTML = model_id;

            var img_html = '<img src="annotation/get_snapshot/' + anno_id + '-' + anno_version + '"></img>';
            row.insertCell(3).innerHTML = img_html;

            var view_html = '<button type="button" onclick="view_model(\''+anno_id+'\')">View</button>';
            row.insertCell(4).innerHTML = view_html;

            var modify_html = '<button type="button" onclick="modify_model(\''+anno_id+'\')">Modify</button>';
            row.insertCell(5).innerHTML = modify_html;

            var delete_html = '<button type="button" onclick="delete_model(\''+anno_id+'\')">Delete</button>';
            row.insertCell(6).innerHTML = delete_html;

            var download_html = '<button type="button" onclick="window.open(\'/annotation/download/'+anno_id+'\', \'_blank\'); return false;">Download</button>';
            row.insertCell(7).innerHTML = download_html;
        }

        $('#myTable').DataTable({
                createdRow: function( row, data, dataIndex ) {
                    if ( data[2] == "0" ) {
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

window.delete_model = function(anno_id) {
    var prompt_str, alert_str;
    prompt_str = 'Are you sure to delete this annotation? All related information will be removed.';
    alert_str = 'Deleted! The webpage will refresh automatically.';
    if (confirm(prompt_str)) {
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                console.log('anno deleted: ' + anno_id);
                alert(alert_str);
                gen_visu_list();
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
