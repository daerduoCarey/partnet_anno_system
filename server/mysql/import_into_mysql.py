import sys
import argparse
import mysql.connector
import json
import os

parser = argparse.ArgumentParser()
parser.add_argument('mysql_host', type=str, help='mysql host')
parser.add_argument('mysql_user', type=str, help='mysql user')
parser.add_argument('mysql_password', type=str, help='mysql password')
parser.add_argument('--database', type=str, default='partnet_anno_system', help='mysql database name [Default: partnet_anno_system]')
args = parser.parse_args()

in_dir = '../storage/data/'

mydb = mysql.connector.connect(
    host=args.mysql_host,
    user=args.mysql_user,
    passwd=args.mysql_password,
    database=args.database
)

# read the db to get the existing records
mycursor = mydb.cursor()
mycursor.execute("SELECT modelID, categoryID FROM Model")
existing_records_in_db = [str(item[0])+'-'+str(item[1]) for item in mycursor.fetchall()]

# then, we import the non-existing records into the db
sql = "INSERT INTO Model (modelID, categoryID) VALUES (%s, %s)"

for catname in os.listdir(in_dir):
    if '.' not in catname:
        for modelid in os.listdir(os.path.join(in_dir, catname)):
            if '.' not in modelid:
                if modelid+'-'+catname in existing_records_in_db:
                    print('SKIP: inserting ', modelid+'-'+catname)
                    continue
        
            try:
                val = (modelid, catname)
                mycursor.execute(sql, val)
                mydb.commit()
                print('SUCCESS: inserting ', modelid+'-'+catname)
            except:
                print('ERROR: inserting ', modelid+'-'+catname)


