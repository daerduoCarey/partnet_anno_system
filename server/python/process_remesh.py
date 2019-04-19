import numpy as np
import json
import sys
import os
from subprocess import call
from config import *

usage = 'process_remesh.py [model-cat]_[model-id]_[list-of-parts]'

def load_obj(fn):
    fin = open(fn, 'r')
    lines = [line.rstrip() for line in fin]
    fin.close()

    vertices = []; faces = [];
    for line in lines:
        if line.startswith('v '):
            vertices.append(np.float32(line.split()[1:4]))
        elif line.startswith('f '):
            faces.append(np.int32([item.split('/')[0] for item in line.split()[1:4]]))

    mesh = dict()
    face_arr = np.vstack(faces)-1
    vertex_arr = np.vstack(vertices)

    return face_arr, vertex_arr


def export_obj(out, v, f):
    with open(out, 'w') as fout:
        for i in range(v.shape[0]):
            fout.write('v %f %f %f\n' % (v[i, 0], v[i, 1], v[i, 2]))
        for i in range(f.shape[0]):
            fout.write('f %d %d %d\n' % (f[i, 0], f[i, 1], f[i, 2]))


code = sys.argv[1]
code_list = code.split('_')

model_cat = code_list[0]
model_id = code_list[1]
anno_id = code_list[2]
input_partid_list = code_list[3:]

original_part_dir = os.path.join(data_dir, model_cat, model_id, ori_part_dir)
remesh_part_dir = os.path.join(anno_dir, anno_id, remesh_part_dir)
new_part_dir = os.path.join(anno_dir, anno_id, new_part_dir)

if not os.path.exists(remesh_part_dir):
    os.mkdir(remesh_part_dir)

# get the output part id
output_partid = -1
for item in os.listdir(remesh_part_dir):
    if item.endswith('.obj'):
        output_partid = max(output_partid, int(item.split('.')[0]))
output_partid += 1

all_verts = []; all_faces = []; num_vert = 0; src_part_list = [];
for input_partid in input_partid_list:
    mesh_type = input_partid.split('-')[0]
    mesh_id = input_partid.split('-')[1]

    if mesh_type == 'original':
        cur_obj_fn = os.path.join(original_part_dir, mesh_id+'.obj')
    else:
        cur_obj_fn = os.path.join(new_part_dir, mesh_id+'.obj')
    
    src_part_list.append(cur_obj_fn)
    faces, vertices = load_obj(cur_obj_fn)

    all_verts.append(vertices)
    all_faces.append(faces+num_vert)
    num_vert += vertices.shape[0]

shape_verts = np.concatenate(all_verts, axis=0)
shape_faces = np.concatenate(all_faces, axis=0) + 1

out_fn = os.path.join(remesh_part_dir, str(output_partid)+'.ori.obj')
remesh_out_fn = os.path.join(remesh_part_dir, str(output_partid)+'.obj')
export_obj(out_fn, shape_verts, shape_faces)

out_json = remesh_out_fn.replace('.obj', '.src.json')
with open(out_json, 'w') as fout:
    json.dump(src_part_list, fout)

call('model_fixer %s %s 5000 >> /dev/null' % (out_fn, remesh_out_fn), shell=True)

print output_partid
