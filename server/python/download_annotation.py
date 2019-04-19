import numpy as np
import json
import sys
import os
from subprocess import call
from config import *

usage = 'download_annotation.py [anno_id] [version_id] [model_cat] [model_id] [user_id]'

anno_id = sys.argv[1]
version_id = sys.argv[2]
model_cat = sys.argv[3]
model_id = sys.argv[4]
user_id = sys.argv[5]

original_part_dir = os.path.join(data_dir, model_cat, model_id, ori_part_dir)
remesh_part_dir = os.path.join(anno_dir, anno_id, remesh_part_dir)
new_part_dir = os.path.join(anno_dir, anno_id, new_part_dir)

cur_output_dir = os.path.join(download_dir, anno_id+'_'+version_id)
if not os.path.exists(cur_output_dir):
    os.mkdir(cur_output_dir)

# calculate total time
tot_time = 0
for i in range(int(version_id)+1):
    time_fn = os.path.join(anno_dir, anno_id, anno_result_dir, str(i)+'.time')
    if os.path.exists(time_fn):
        with open(time_fn, 'r') as fin:
            time_str = fin.readlines()[0].rstrip()
            time_in_sec = sum(x * int(t) for x, t in zip([3600, 60, 1], time_str.split(":"))) 
            tot_time += time_in_sec

# make a meta json file
res = {'user_id': user_id, 'model_cat': model_cat, 'model_id': model_id, 'version': version_id, 'anno_id': anno_id, 'time_in_sec': str(tot_time)};
output_fn = os.path.join(cur_output_dir, 'meta.json')
with open(output_fn, 'w') as fout:
    json.dump(res, fout)

# Load results
input_result_json = os.path.join(anno_dir, anno_id, anno_result_dir, version_id+'.json')
input_qa_json = os.path.join(anno_dir, anno_id, anno_result_dir, version_id+'.qa.json')

with open(input_result_json, 'r') as fin:
    input_result = json.load(fin)

with open(input_qa_json, 'r') as fin:
    input_qa = json.load(fin)

output_obj_dir = os.path.join(cur_output_dir, 'objs')
if not os.path.exists(output_obj_dir):
    os.mkdir(output_obj_dir)

def download_obj(fn):
    x, y = fn.split('-')
    if x == 'original':
        src_fn = os.path.join(original_part_dir, y+'.obj')
    elif x == 'new':
        src_fn = os.path.join(new_part_dir, y+'.obj')
    else:
        print 'ERROR. Unknown mesh type: ', x
    
    cmd = 'cp %s %s' % (src_fn, os.path.join(output_obj_dir, fn+'.obj'))
    call(cmd, shell=True)

def gen_res(res_data):
    res = []
    for item in res_data:
        new_item = {}
        new_item['id'] = item['my_id']
        new_item['name'] = item['name']
        new_item['text'] = item['text']
        if 'nodes' in item.keys():
            new_item['children'] = gen_res(item['nodes']);
        if 'parts' in item.keys():
            new_item['objs'] = item['parts'];
            for part_item in item['parts']:
                download_obj(part_item)
        if str(item['my_id']) in input_qa['my_id_to_question'].keys():
            record = input_qa['my_id_to_question'][str(item['my_id'])]
            if 'star_rating' in record.keys():
                new_item['conf_score'] = record['star_rating']
            if 'low_conf_reason' in record.keys():
                new_item['low_conf_reason'] = record['low_conf_reason']
        res.append(new_item)
    return res

output_res = gen_res(input_result)
with open(os.path.join(cur_output_dir, 'result.json'), 'w') as fout:
    json.dump(output_res, fout)

cmd = 'cd %s && zip -r %s.zip %s' % (download_dir, anno_id+'_'+version_id, anno_id+'_'+version_id)
call(cmd, shell=True)

print 'Done.'
