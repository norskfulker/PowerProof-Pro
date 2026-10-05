import json,collections,re,sys
d=json.load(open(sys.argv[1]))
rules=collections.Counter(); fails=[]; details=collections.defaultdict(list)
def walk(s):
    for sp in s.get('specs',[]):
        for t in sp['tests']:
            for r in t['results'][-1:]:
                if r['status'] not in ('passed','skipped'):
                    msg=(r.get('error') or {}).get('message','')
                    fails.append((t['projectName'],sp['title'],msg))
    for c in s.get('suites',[]): walk(c)
for s in d['suites']: walk(s)
print('failures:',len(fails))
for p,t,m in fails:
    m=re.sub(r'\x1b\[[0-9;]*m','',m)
    for line in m.split('\n'):
        mm=re.match(r'\s*\[([a-z-]+)\] (.*)',line)
        if mm: rules[mm.group(1)]+=1; details[mm.group(1)].append(f'{p} {t}: {mm.group(2)}')
        mm2=re.match(r'\s*(?:Error: )?([a-z-]+) \((serious|critical)\): (.*)',line)
        if mm2: rules['axe:'+mm2.group(1)]+=1; details['axe:'+mm2.group(1)].append(f'{p} {t}')
        if line.startswith('error:') or line.startswith('pageerror') or line.startswith('warning:'):
            rules['console']+=1; details['console'].append(f'{p} {t}: {line[:200]}')
print(rules.most_common())
want=sys.argv[2:] or list(details)
for k in want:
    print('==',k)
    seen=set()
    for x in details[k]:
        key=re.sub(r'\d+px|\d+x\d+|at \d+,\d+ and \d+,\d+','#',x)
        if key in seen: continue
        seen.add(key); print('  ',x[:230])
        if len(seen)>40: break
