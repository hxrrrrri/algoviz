from executor import PythonExecutor

with open('tmp_user_code_clean.py', 'r', encoding='utf-8') as f:
    code = f.read()

trace = PythonExecutor(max_steps=5000, timeout=8.0).execute(code, [])

ml_hints = {'training_history','nn_model','ml_model'}
ml_steps = []
for i, s in enumerate(trace):
    h = s.get('structure_hints') or {}
    loc = s.get('locals') or {}
    has = any((hh in ml_hints and n in loc) for n, hh in h.items())
    if has:
        ml_steps.append((i, s.get('line')))

print('TOTAL_STEPS', len(trace))
print('FIRST_ML_STEP', ml_steps[0][0] if ml_steps else None)
print('LAST_ML_STEP', ml_steps[-1][0] if ml_steps else None)
print('ML_STEPS_COUNT', len(ml_steps))
print('FIRST_ERROR', trace[0].get('error') if trace else None)
print('LAST_ERROR', trace[-1].get('error') if trace else None)
