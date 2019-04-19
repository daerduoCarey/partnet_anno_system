import json
import os
import sys
from collections import deque

dir_list = [item for item in os.listdir('.') if '.' not in item and item != 'common']
print dir_list

for cat in dir_list:

    in_dir = os.path.join(cat, 'imgs')
    if os.path.exists(in_dir):
        out_file = os.path.join(cat, 'all_example_img_filelist.json')

        with open(os.path.join(cat, 'template.json'), 'r') as fin:
            data = json.load(fin)
            root = data['root']
            print cat, root

        valid_suffix = ['jpg', 'jpeg', 'png']

        out = dict()
        q = deque()
        out[root] = []
        cur_part = root
        q.append(root)
        while len(q) > 0:
            cur_part = q.popleft()
            for item in os.listdir(os.path.join(in_dir, cur_part)):
                if not item.startswith('.'):
                    is_img = False
                    for img_suffix in valid_suffix:
                        if item.endswith(img_suffix):
                            out[cur_part].append(item)
                            is_img = True
                            break
                    if not is_img:
                        out[os.path.join(cur_part, item)] = []
                        q.append(os.path.join(cur_part, item))

        for k in out.keys():
            out[k] = sorted(out[k])

        with open(out_file, 'w') as fout:
            json.dump(out, fout)

