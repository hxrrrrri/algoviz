import json
from executor import PythonExecutor
import re

with open('tmp_user_code.py', 'r', encoding='utf-8') as f:
    code = f.read()

ex = PythonExecutor(max_steps=5000, timeout=8.0)
trace = ex.execute(code, [])

ml_hints = {'training_history','nn_model','ml_model'}
ml_steps = []
for i,s in enumerate(trace):
    h = s.get('structure_hints') or {}
    loc = s.get('locals') or {}
    has = False
    for n,hh in h.items():
        if hh in ml_hints and n in loc:
            has = True
            break
    if has:
        ml_steps.append((i, s.get('line'), list(h.items())[:8]))

print('TOTAL_STEPS', len(trace))
print('FIRST_STEP_LINE', trace[0].get('line') if trace else None)
print('LAST_STEP_LINE', trace[-1].get('line') if trace else None)
print('FIRST_ML_STEP', ml_steps[0][0] if ml_steps else None)
print('FIRST_ML_LINE', ml_steps[0][1] if ml_steps else None)
print('LAST_ML_STEP', ml_steps[-1][0] if ml_steps else None)
print('LAST_ML_LINE', ml_steps[-1][1] if ml_steps else None)
print('ML_STEPS_COUNT', len(ml_steps))
if ml_steps:
    print('FIRST_ML_HINTS', ml_steps[0][2])
    print('LAST_ML_HINTS', ml_steps[-1][2])

# Print first 25 (idx,line,event) for quick shape
for i,s in enumerate(trace[:25]):
    print('STEP', i, 'LINE', s.get('line'), 'EVENT', s.get('event'))

# Print last 15 steps
for i,s in enumerate(trace[-15:], start=max(0,len(trace)-15)):
    print('ENDSTEP', i, 'LINE', s.get('line'), 'EVENT', s.get('event'), 'ERR', bool(s.get('error')))
