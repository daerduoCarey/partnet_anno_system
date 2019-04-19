var express = require('express');
var router = express.Router();
var cmd = require('node-cmd');  // TODO node-cmd
var fs = require('fs');
var path = require('path');
var multiparty = require('multiparty');
var server = require('../config/server.js');

var sleep = require('sleep');

const mysql = require('mysql');

const pool = mysql.createPool({
    host: server.DB_HOST,
    user: server.DB_USER,
    password: server.DB_PASSWORD,
    database: server.DB_NAME,
});

router.get('/get_info/:anno_id', function(req, res, next) {
    var result = {};

    // return a json storing the model-cat, model-id, user-name, parent-anno-id and so on
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log('[ connect error ]');
            res.status(400);
            res.end('Failed');
            connection.release();
        } else {
            console.log("[ database connected ]");
        }

        const query = "SELECT *\n" +
            "FROM Annotation\n" +
            "WHERE annotationID = '" + req.params.anno_id +
            "';";
        console.log('[Get Info] mysql query: '+query);
        connection.query(query, function (error, results, field) {
            if (error) {
                console.log('[ error (threw) ]', error);
                res.status(400);
                res.end('Failed');
                connection.release();
            }

            console.log('[ result ]', results[0]);
            if (results[0] === undefined) {
                console.log('[ no corresponding anno id: ]' + req.params.anno_id);
            } else {
                result.model_cat = results[0].modelCat; // table name in the database
                result.model_id = results[0].modelID;
                result.username = results[0].workerID;
                result.version = results[0].version;
            }

            res.status(200);
            res.json(result);

            connection.release();
        });
    });
});

router.get('/get_json/:anno_id-:version', function (req, res, next) {
    var anno_id = req.params.anno_id;
    var version = req.params.version;

    // find the current version id and return the json file
    var fn_path = server.DIR + '/' + server.ANNO_DIR + '/' + req.params.anno_id + '/' +
        server.ANNO_RES_DIR + '/' + version + '.json';

    console.log('[Annotation Json] fn_path: '+fn_path);
    res.status(200);
    res.download(fn_path);
});

router.get('/get_qa/:anno_id-:version', function (req, res, next) {
    var anno_id = req.params.anno_id;
    var version = req.params.version;

    // find the current version id and return the json file
    var fn_path = server.DIR + '/' + server.ANNO_DIR + '/' + req.params.anno_id + '/' +
        server.ANNO_RES_DIR + '/' + version + '.qa.json';

    console.log('[Annotation QA] fn_path: '+fn_path);
    res.status(200);
    res.download(fn_path);
});

router.get('/get_obj_list/:anno_id-:version', function (req, res, next) {
    var anno_id = req.params.anno_id;
    var version = req.params.version;

    // find the current version id and return the json file
    var fn_path = server.DIR + '/' + server.ANNO_DIR + '/' + req.params.anno_id + '/' +
        server.ANNO_RES_DIR + '/' + version + '.obj_list.json';

    console.log('[Annotation Json] fn_path: '+fn_path);
    res.status(200);
    res.download(fn_path);
});

router.get('/get_snapshot/:anno_id-:version', function (req, res, next) {
    var anno_id = req.params.anno_id;
    var version = req.params.version;

    // find the current version id and return the json file
    var fn_path = server.DIR + '/' + server.ANNO_DIR + '/' + req.params.anno_id + '/' +
        server.ANNO_RES_DIR + '/' + version + '.jpg';

    console.log('[Annotation Snapshot] fn_path: '+fn_path);
    res.status(200);
    res.download(fn_path);
});

router.post('/save_json', function (req, res, next) {
    var anno_id = undefined;
    var anno_version = undefined;
    var json_data = undefined;

    var form = new multiparty.Form();

    form.on('error', function() {
        console.log('error');
        res.status(400);
        res.end('Failed');
    });

    // listen on field event for title
    form.on('field', function(name, val) {
        if (name === 'data') {
            var json = JSON.parse(val);

            var anno_version = json.anno_version;
            var anno_id = json.anno_id;
            var json_data = json.data;

            var out_fn = server.DIR + '/' + server.ANNO_DIR + '/' + anno_id + '/' +
                server.ANNO_RES_DIR + '/' + anno_version + '.json';

            fs.writeFile(out_fn, json_data, 'utf8',
                function (err) {
                    if (err) {
                        console.log(err);
                        console.log(json_data);
                        res.status(400);
                        res.end('Failed');
                    }
                });
            console.log('[Save Json] data saved to ' + out_fn);

            var out_fn = server.DIR + '/' + server.ANNO_DIR + '/' + anno_id + '/' +
                server.ANNO_RES_DIR + '/' + anno_version + '.time';

            fs.writeFile(out_fn, json.time, 'utf8',
                function (err) {
                    if (err) {
                        console.log(err);
                        console.log(json.time);
                        res.status(400);
                        res.end('Failed');
                    }
                });
            console.log('[Save Time] data saved to ' + out_fn);

            res.status(200);
            res.end();
        }
    });


    // parse the form
    form.parse(req);
});

router.post('/save_qa', function (req, res, next) {
    var anno_id = undefined;
    var anno_version = undefined;
    var json_data = undefined;

    var form = new multiparty.Form();

    form.on('error', function() {
        console.log('error');
        res.status(400);
        res.end('Failed');
    });

    // listen on field event for title
    form.on('field', function(name, val) {
        if (name === 'data') {
            var json = JSON.parse(val);

            var anno_version = json.anno_version;
            var anno_id = json.anno_id;
            var json_data = json.data;

            var out_fn = server.DIR + '/' + server.ANNO_DIR + '/' + anno_id + '/' +
                server.ANNO_RES_DIR + '/' + anno_version + '.qa.json';

            fs.writeFile(out_fn, json_data, 'utf8',
                function (err) {
                    if (err) {
                        console.log(err);
                        console.log(json_data);
                        res.status(400);
                        res.end('Failed');
                    }
                });
            console.log('[Save Json] data saved to ' + out_fn);

            res.status(200);
            res.end();
        }
    });


    // parse the form
    form.parse(req);
});

router.post('/save_obj_list', function (req, res, next) {
    var anno_id = undefined;
    var anno_version = undefined;
    var json_data = undefined;

    var form = new multiparty.Form();

    form.on('error', function() {
        console.log('error');
        res.status(400);
        res.end('Failed');
    });

    // listen on field event for title
    form.on('field', function(name, val) {
        if (name === 'data') {
            var json = JSON.parse(val);

            var anno_version = json.anno_version;
            var anno_id = json.anno_id;
            var json_data = json.data;

            var out_fn = server.DIR + '/' + server.ANNO_DIR + '/' + anno_id + '/' +
                server.ANNO_RES_DIR + '/' + anno_version + '.obj_list.json';

            fs.writeFile(out_fn, json_data, 'utf8',
                function (err) {
                    if (err) {
                        console.log(err);
                        console.log(json_data);
                        res.status(400);
                        res.end('Failed');
                    }
                });
            console.log('[Save Json] data saved to ' + out_fn);

            res.status(200);
            res.end();
        }
    });


    // parse the form
    form.parse(req);
});

router.post('/save_snapshot', function (req, res, next) {
    var anno_id = undefined;
    var anno_version = undefined;
    var img_data = undefined;

    var form = new multiparty.Form();

    form.on('error', function() {
        console.log('error');
        res.status(400);
        res.end('Failed');
    });

    // listen on field event for title
    form.on('field', function(name, val) {
        if (name === 'data') {
            var json = JSON.parse(val);

            var anno_version = json.anno_version;
            var anno_id = json.anno_id;
            var img_data = json.img;

            var out_fn = server.DIR + '/' + server.ANNO_DIR + '/' + anno_id + '/' +
                server.ANNO_RES_DIR + '/' + anno_version + '.jpg';

            var base64Data = img_data.replace(/^data:image\/jpeg;base64,/, "");

            fs.writeFile(out_fn, base64Data, 'base64',
                function (err) {
                    if (err) {
                        console.log(err);
                        res.status(400);
                        res.end('Failed');
                    }
                });
            console.log('[Save Snapshot] data saved to ' + out_fn);

            res.status(200);
            res.end();
        }
    });

    // parse the form
    form.parse(req);
});

router.post('/update_version', function (req, res, next) {
    var anno_id = undefined;
    var anno_version = undefined;

    console.log('[POST update version]');

    var form = new multiparty.Form();

    form.on('error', function() {
        console.log('error');
        res.status(400);
        res.end('Failed');
    });

    // listen on field event for title
    form.on('field', function(name, val) {
        if (name === 'data') {
            var json = JSON.parse(val);

            var anno_version = json.anno_version;
            var anno_id = json.anno_id;

            // get all annotation records for the current user (all active ones, no deleted ones)
            pool.getConnection(function (error, connection) {
                if (error) {
                    console.log('[ connect error ]');
                    res.status(400);
                    res.end('Failed');
                    connection.release();
                } else {
                    console.log("[ database connected ]");
                }

                const query = "UPDATE Annotation\n" +
                    "SET version = " + (anno_version + 1) + "\n" +
                    "WHERE annotationID = " + anno_id +
                    ";";
                console.log('[Update Anno Version] query: ' + query);
                connection.query(query, function (error, results, field) {
                    if (error) {
                        console.log('[ error (threw) ]', error);
                        res.end('Failed');
                        connection.release();
                    }

                    console.log('[ result ]', results);

                    if (results.affectedRows === 1) {
                        console.log('Record updated!');
                        res.status(200);
                        res.end();
                    } else {
                        console.log('[error] No record updated!');
                        res.status(400);
                        res.end();
                    }

                    connection.release();
                });
            });
        }
    });

    // parse the form
    form.parse(req);
});

router.get('/get_all_annotations/:username/:catname', function(req, res, next) {
    var username = req.params.username;
    var anno_list = [];

    // get all annotation records for the current user (all active ones, no deleted ones)
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log('[ connect error ]');
            res.status(400);
            res.end('Failed');
            connection.release();
        } else {
            console.log("[ database connected ]");
        }

        const query = "SELECT *\n" +
            "FROM Annotation\n" +
            "WHERE workerID = '" + req.params.username + "' AND annoState = 'active'" +
            " AND modelCat = '" + req.params.catname + "'" + 
            ";";
        console.log('[Get All Annotations] query: '+query);
        connection.query(query, function (error, results, field) {
            if (error) {
                console.log('[ error (threw) ]', error);
                res.status(400);
                res.end('Failed');
                connection.release();
            }

            console.log('[ result ]', results);

            for (let result of results) {
                anno_list.push({
                    model_id: result.modelID,
                    anno_id: result.annotationID,
                    version: result.version,
                })
            }

            res.status(200);
            res.json({anno_list: anno_list});

            connection.release();
        });
    });
});

router.get('/get_all_annotations_admin/:catname', function(req, res, next) {
    var anno_list = [];
    var model_cat = req.params.catname;

    // get all annotation records for the current user (all active ones, no deleted ones)
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log('[ connect error ]');
            res.status(400);
            res.end('Failed');
            connection.release();
        } else {
            console.log("[ database connected ]");
        }

        const query = "SELECT *\n" +
            "FROM Annotation\n" +
            "WHERE annoState = 'active' " +
            "AND modelCat = '" + model_cat + "'"
            ";";
        console.log('[Get All Annotations] query: '+query);
        connection.query(query, function (error, results, field) {
            if (error) {
                console.log('[ error (threw) ]', error);
                res.status(400);
                res.end('Failed');
                connection.release();
            }

            console.log('[ result ]', results);

            for (let result of results) {
                anno_list.push({
                    user_id: result.workerID,
                    model_id: result.modelID,
                    model_cat: result.modelCat,
                    anno_id: result.annotationID,
                    anno_src_id: result.annotationSourceID,
                    anno_src_info: result.annotationSource,
                    version: result.version,
                })
            }

            res.status(200);
            res.json({anno_list: anno_list});

            connection.release();
        });
    });
});


router.get('/get_new_model/:catname-:username', function(req, res, next) {
    var new_anno_id = null;
    var model_cat = req.params.catname;
    var model_id = null;

    // get a new model_cat/model_id for the user to annotate
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log('[ connect error ]');
            res.status(400);
            res.end('Failed');
        } else {
            console.log("[ database connected ]");
        }

        
        const query = "SELECT Model.modelID\n" +
            "FROM Model\n" +
            "WHERE (SELECT COUNT(*) FROM Annotation WHERE modelID = Model.modelID AND modelCat = '"+
                req.params.catname+"' AND workerID = '"+req.params.username+"' AND annoState = 'active') = 0" +  "\n" + 
            "AND categoryID = '" + req.params.catname + "'\n" +
            "LIMIT 1;";
            
        console.log('[Get New Model] mysql query: '+query);
        connection.query(query, function (error, results, field) {
            if (error) {
                console.log('[ error (threw) ]', error);
                res.status(400);
                res.end('Failed');
                connection.release();
            } else {
                console.log('[ result ]', results[0]);

                if (results[0] === undefined) {
                    console.log('[error] no new models to label');
                    res.status(200);
                    res.end('All-done');
                    connection.release();
                } else {

                    model_id = results[0].modelID;

                    const query_add = "INSERT INTO Annotation (modelID, ModelCat, workerID)\n" +
                        "VALUES ('" + model_id + "', '" + model_cat +
                        "', '" + req.params.username +
                        "');";
                    console.log('[Get New Model] mysql query: ' + query_add);
                    connection.query(query_add, function (error, results, field) {
                        if (error) {
                            console.log('[ error (threw) ]', error);
                            res.status(400);
                            res.end('Failed');
                            connection.release();
                        }
                        const query_new = "SELECT LAST_INSERT_ID();";
                        connection.query(query_new, function (error, results, field) {
                            if (error) {
                                console.log('[ error (threw) ]', error);
                                res.status(400);
                                res.end('Failed');
                                connection.release();
                            }

                            console.log('[ result ]', results);

                            new_anno_id = results[0]['LAST_INSERT_ID()'];
                            console.log("[ new annotation id: ]" + new_anno_id);

                            // create a new folder on disk
                            var dir_fn = server.DIR + '/' + server.ANNO_DIR + '/' + new_anno_id;
                            fs.mkdirSync(dir_fn);

                            var new_dir = dir_fn + '/' + server.REMESH_PART_DIR;
                            fs.mkdirSync(new_dir);
                            new_dir = dir_fn + '/' + server.NEW_PART_DIR;
                            fs.mkdirSync(new_dir);
                            new_dir = dir_fn + '/' + server.ANNO_RES_DIR;
                            fs.mkdirSync(new_dir);

                            // update the record from model table: ++ numAnno
                            const query = "UPDATE Model\n" +
                                "SET numAnno = numAnno + 1\n" +
                                "WHERE modelID = '" + model_id +
                                "';";
                            console.log('[Delete an Anno] mysql query: ' + query);
                            connection.query(query, function (error, results, field) {
                                if (error) {
                                    console.log('[ error (threw) ]', error);
                                    res.end('Failed');
                                    connection.release();
                                }

                                res.status(200);
                                res.end('' + new_anno_id);

                                connection.release();
                            });
                        })
                    })
                }
            }
        });
    });
});

router.get('/get_new_model_by_id/:username-:modelid', function(req, res, next) {
    var new_anno_id = null;
    var model_cat = null;
    var model_id = req.params.modelid;

    // get a new model_cat/model_id for the user to annotate
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log('[ connect error ]');
            res.status(400);
            res.end('Failed');
        } else {
            console.log("[ database connected ]");
        }

        const query = "SELECT modelID, categoryID\n" +
            "FROM Model\n" +
            "Where modelID = '" + model_id + "';";
        console.log('[Get New Model by id] mysql query: '+query);
        connection.query(query, function (error, results, field) {
            if (error) {
                console.log('[ error (threw) ]', error);
                res.status(400);
                res.end('Failed');
                connection.release();
            } else {
                console.log('[ result ]', results[0]);

                if (results[0] === undefined) {
                    console.log('[error] no new models to label');
                    res.status(400);
                    res.end('No-model');
                    connection.release();
                } else {

                    model_cat = results[0].categoryID;

                    const query_add = "INSERT INTO Annotation (modelID, ModelCat, workerID)\n" +
                        "VALUES ('" + model_id + "', '" + model_cat +
                        "', '" + req.params.username +
                        "');";
                    console.log('[Get New Model] mysql query: ' + query_add);
                    connection.query(query_add, function (error, results, field) {
                        if (error) {
                            console.log('[ error (threw) ]', error);
                            res.status(400);
                            res.end('Failed');
                            connection.release();
                        }
                        const query_new = "SELECT LAST_INSERT_ID();";
                        connection.query(query_new, function (error, results, field) {
                            if (error) {
                                console.log('[ error (threw) ]', error);
                                res.status(400);
                                res.end('Failed');
                                connection.release();
                            }

                            console.log('[ result ]', results);

                            new_anno_id = results[0]['LAST_INSERT_ID()'];
                            console.log("[ new annotation id: ]" + new_anno_id);

                            // create a new folder on disk
                            var dir_fn = server.DIR + '/' + server.ANNO_DIR + '/' + new_anno_id;
                            fs.mkdirSync(dir_fn);

                            var new_dir = dir_fn + '/' + server.REMESH_PART_DIR;
                            fs.mkdirSync(new_dir);
                            new_dir = dir_fn + '/' + server.NEW_PART_DIR;
                            fs.mkdirSync(new_dir);
                            new_dir = dir_fn + '/' + server.ANNO_RES_DIR;
                            fs.mkdirSync(new_dir);

                            // update the record from model table: ++ numAnno
                            const query = "UPDATE Model\n" +
                                "SET numAnno = numAnno + 1\n" +
                                "WHERE modelID = '" + model_id +
                                "';";
                            console.log('[Delete an Anno] mysql query: ' + query);
                            connection.query(query, function (error, results, field) {
                                if (error) {
                                    console.log('[ error (threw) ]', error);
                                    res.end('Failed');
                                    connection.release();
                                }

                                res.status(200);
                                res.end('' + new_anno_id);

                                connection.release();
                            });
                        })
                    })
                }
            }
        });
    });
});

router.get('/delete/:anno_id', function (req, res, next) {
    // given a current anno_id, delete the record
    // DO NOT delete anything (NEVER DELETE ANY DATA WHEN DOING RESEARCH)
    // Just mark the annotation record with anno_state:='deleted'
    pool.getConnection(function (error, connection) {
        if (error) {
            console.log('[ connect error ]');
            res.status(400);
            res.end('Failed');
            connection.release();
        } else {
            console.log("[ database connected ]");
        }

        const query = "UPDATE Annotation\n" +
            "SET annoState = 'deleted'\n" +
            "WHERE annotationID = '" + req.params.anno_id +
            "';";
        console.log('[Delete an Anno] mysql query: '+query);
        connection.query(query, function (error, results, field) {
            if (error) {
                console.log('[ error (threw) ]', error);
                res.status(400);
                res.end('Failed');
                connection.release();
            }
            console.log('[ marked the annotation [' + req.params.anno_id + '] as deleted ]', results);

            // get model id
            const query = "SELECT modelID\n" +
                "FROM Annotation\n" +
                "WHERE annotationID = '" + req.params.anno_id +
                "';";
            console.log('[Delete an Anno] mysql query: '+query);
            connection.query(query, function (error, results, field) {
                if (error) {
                    console.log('[ error (threw) ]', error);
                    res.status(400);
                    res.end('Failed');
                    connection.release();
                }

                var model_id = results[0].modelID;

                // delete the record from model table: -- numAnno
                const query = "UPDATE Model\n" +
                    "SET numAnno = numAnno - 1\n" +
                    "WHERE modelID = '" + model_id +
                    "';";
                console.log('[Delete an Anno] mysql query: ' + query);
                connection.query(query, function (error, results, field) {
                    if (error) {
                        console.log('[ error (threw) ]', error);
                        res.end('Failed');
                        connection.release();
                    }

                    res.status(200);
                    res.end('Finished');

                    connection.release();
                });
            });
        });
    });
});


router.get('/download/:anno_id', function(req, res, next) {
    var result = {};

    pool.getConnection(function (error, connection) {
        if (error) {
            console.log('[ connect error ]');
            res.status(400);
            res.end('Failed');
            connection.release();
        } else {
            console.log("[ database connected ]");
        }

        const query = "SELECT *\n" +
            "FROM Annotation\n" +
            "WHERE annotationID = '" + req.params.anno_id +
            "';";
        console.log('[Get Info] mysql query: '+query);
        connection.query(query, function (error, results, field) {
            if (error) {
                console.log('[ error (threw) ]', error);
                res.status(400);
                res.end('Failed');
                connection.release();
            }

            console.log('[ result ]', results[0]);
            if (results[0] === undefined) {
                console.log('[ no corresponding anno id: ]' + req.params.anno_id);
            } else {
                result.model_cat = results[0].modelCat; // table name in the database
                result.model_id = results[0].modelID;
                result.username = results[0].workerID;
                result.version = results[0].version;
            }

            var output_zip = server.DIR + '/' + server.DOWNLOAD_DIR + '/' + req.params.anno_id + '_' + result.version + '.zip';
            console.log('Dumping zip file to: ', output_zip);

            fs.stat(output_zip, function(err, stat) {
                if(err == null) {
                    console.log('File exists: ', output_zip);

                    res.status(200).download(output_zip);

                } else if(err.code == 'ENOENT') {
                    console.log('File NOT exists: ', output_zip);

                    var cmd_to_execute = 'python ' + server.CODE_DIR + '/server/python/download_annotation.py '
                            + req.params.anno_id + ' ' + result.version + ' ' + result.model_cat + ' ' 
                            + result.model_id + ' ' + result.username;

                    console.log('Generating it using command: ', cmd_to_execute);

                    cmd.get(cmd_to_execute,
                        function(err, data, stderr) {
                            if (err === null) {
                                console.log('SUCCESS!');
                                res.status(200).download(output_zip);
                            } else {
                                console.log('FAILED! error: ', err);
                            }
                        }
                    );

                } else {
                     console.log('FAILED! Some other error: ', err);
                }
            });
            connection.release();
        });
    });
});


module.exports = router;
