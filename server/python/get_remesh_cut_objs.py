import os
import ast
import numpy as np
import sys
import json
from config import *

usage = 'python get_remesh_cut_objs.py [input_json]'

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
    face_arr = np.vstack(faces)
    vertex_arr = np.vstack(vertices)

    return face_arr, vertex_arr


def export_obj(out, v, f):
    with open(out, 'w') as fout:
        for i in range(v.shape[0]):
            fout.write('v %f %f %f\n' % (v[i, 0], v[i, 1], v[i, 2]))
        for i in range(f.shape[0]):
            fout.write('f %d %d %d\n' % (f[i, 0], f[i, 1], f[i, 2]))



in_file = sys.argv[1]
file_parts = in_file.split('/')

in_obj = in_file.replace('.json', '.obj')
out_json = in_file.replace('.json', '.new_parts.json')

model_cat = file_parts[-4]
model_id = file_parts[-3]

out_dir = os.path.join(os.path.dirname(in_file),  '..', new_part_dir)
if not os.path.exists(out_dir):
    os.mkdir(out_dir)

# get the new part id to generate
cur_id = -1
for item in os.listdir(out_dir):
    if item.endswith('.obj'):
        cur_id = max(cur_id, int(item.split('.')[0]))

# read in the part seg and store the new part
with open(in_file, 'r') as fin:
    data = json.load(fin)

data = ast.literal_eval(data['data'])
part_seg = np.array(data).astype(np.int32)
max_part_id = np.max(part_seg)

# load obj
ori_face, ori_vertex = load_obj(in_obj)

# export all part cut
output_list = [];
for i in range(max_part_id):
    cur_out = os.path.join(out_dir, str((cur_id+i+1))+'.obj')
    export_obj(cur_out, ori_vertex, ori_face[part_seg==i+1])
    output_list.append(cur_id+i+1)

    txt_out = cur_out.replace('.obj', '.txt')
    with open(txt_out, 'w') as fout:
        fout.write(in_file)

with open(out_json, 'w') as fout:
    json.dump(output_list, fout)

