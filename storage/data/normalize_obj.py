import os
import sys
from geometry_utils import *
from progressbar import ProgressBar
import numpy as np
import json

input_dir = sys.argv[1]

bar = ProgressBar()
for item in bar(os.listdir(input_dir)):
    print item
    if not item.startswith('.'):
        cur_dir = os.path.join(input_dir, item)
        in_dir = os.path.join(cur_dir, 'leaf_part_obj')
        out_dir = os.path.join(cur_dir, 'leaf_part_obj_normalized')
        if not os.path.exists(out_dir):
            os.mkdir(out_dir)

        try:
            
            with open(os.path.join(cur_dir, 'leaf_part_ids.json'), 'r') as fin:
                part_list = json.load(fin)

            f_list = []; v_list = []; tot_v = 0;
            ff_list = []; vv_list = []; part_name_list = []
            for part_id in part_list:
                mesh = load_obj(os.path.join(in_dir, str(part_id)+'.obj'), no_normal=True)
                f = mesh['faces']
                v = mesh['vertices']
                v_list.append(v)
                vv_list.append(v)
                f_list.append(f+tot_v)
                ff_list.append(f)
                part_name_list.append(part_id)
                tot_v += v.shape[0]

            f_arr = np.vstack(f_list)
            v_arr = np.vstack(v_list)

            pts,_  = sample_points(v_arr, f_arr, label=None, num_points=200)

            center = np.mean(pts, axis=0)
            pts -= center
            scale = np.sqrt(np.max(np.sum(pts**2, axis=1)))
            
            with open(os.path.join(cur_dir, 'normalization_params.txt'), 'w') as fout:
                fout.write('%f %f %f\n' %(center[0], center[1], center[2]))
                fout.write('%f' % scale)

            for i in range(len(part_name_list)):
                out_fn = os.path.join(out_dir, str(part_name_list[i])+'.obj')
                export_obj(out_fn, (vv_list[i]-center)/scale, ff_list[i])

        except:
            print 'ERROR', item


