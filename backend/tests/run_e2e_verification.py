import urllib.request, json, time, io, wave

base_url = 'http://127.0.0.1:8010'

# 1. Candidate Registration
reg_payload = json.dumps({
    'name': 'Priya Ananth',
    'email': 'priya.ananth@example.com',
    'phone': '+91 9123456789',
    'role_id': 'java-developer',
    'role_title': 'Java Enterprise Backend',
    'experience_level': 'Senior (5+ yrs)',
    'institution': 'BITS Pilani',
    'interview_type': 'company'
}).encode()
req1 = urllib.request.Request(f'{base_url}/api/candidate/register', data=reg_payload, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req1) as r1:
    res1 = json.loads(r1.read().decode())
    cid = res1['candidate_id']
    print('STEP 1: Registration PASS, candidate_id:', cid)

# 2. Candidate Consent
consent_payload = json.dumps({
    'session_id': f'e2e-{cid[:8]}',
    'candidate_id': cid,
    'camera_consent': True,
    'microphone_consent': True,
    'environment_monitoring_consent': True,
    'store_recording_consent': True
}).encode()
req2 = urllib.request.Request(f'{base_url}/api/security/consent', data=consent_payload, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req2) as r2:
    print('STEP 2: Consent PASS')

# 3. System Readiness Diagnostics
diag_payload = json.dumps({
    'session_id': f'e2e-{cid[:8]}',
    'camera_passed': True,
    'microphone_passed': True,
    'audio_playback_passed': True,
    'network_latency_ms': 35.0,
    'throughput_kbps': 1200.0,
    'browser_compatible': True,
    'fullscreen_available': True,
    'screenshare_available': False
}).encode()
req3 = urllib.request.Request(f'{base_url}/api/security/diagnostics', data=diag_payload, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req3) as r3:
    print('STEP 3: Diagnostics PASS')

# 4. Session Start
start_payload = json.dumps({
    'role_id': 'java-developer',
    'mode': 'company',
    'total_questions': 3,
    'experience_level': 'Senior (5+ yrs)',
    'language': 'en-IN',
    'candidate_id': cid,
    'candidate_name': 'Priya Ananth',
    'candidate_email': 'priya.ananth@example.com'
}).encode()
req4 = urllib.request.Request(f'{base_url}/api/session/start', data=start_payload, headers={'Content-Type': 'application/json'})
t_start = time.time()
with urllib.request.urlopen(req4) as r4:
    sdata = json.loads(r4.read().decode())
    sid = sdata['session_id']
    q1 = sdata['question']
    lat_start = (time.time() - t_start) * 1000
    has_audio = bool(sdata.get('question_audio_b64'))
    print(f'STEP 4: Session Start PASS in {lat_start:.1f}ms, session_id: {sid}, Q1 audio present: {has_audio}')

# 5. Answer Submission (mocked wav response)
wav_buffer = io.BytesIO()
with wave.open(wav_buffer, 'wb') as wav_file:
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(16000)
    wav_file.writeframes(b'\x00\x00' * 8000)
audio_bytes = wav_buffer.getvalue()

boundary = '----WebKitFormBoundaryE2ETest123'
lines = []
def add_field(name, val):
    lines.append(f'--{boundary}'.encode())
    lines.append(f'Content-Disposition: form-data; name="{name}"'.encode())
    lines.append(b'')
    lines.append(str(val).encode())

add_field('session_id', sid)
add_field('question_id', q1['id'])
add_field('language', 'en-IN')
lines.append(f'--{boundary}'.encode())
lines.append(b'Content-Disposition: form-data; name="audio"; filename="answer.wav"')
lines.append(b'Content-Type: audio/wav')
lines.append(b'')
lines.append(audio_bytes)
lines.append(f'--{boundary}--'.encode())
body = b'\r\n'.join(lines)

t_eval = time.time()
req5 = urllib.request.Request(f'{base_url}/api/session/answer', data=body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
with urllib.request.urlopen(req5) as r5:
    res5 = json.loads(r5.read().decode())
    lat_eval = (time.time() - t_eval) * 1000
    print(f'STEP 5: Answer Evaluation & Next Question PASS in {lat_eval:.1f}ms, score: {res5.get("overall_score")}, next Q: {res5.get("next_question", {}).get("id")}')

# 6. Retrieve Final Report
req6 = urllib.request.Request(f'{base_url}/api/session/{sid}/report')
with urllib.request.urlopen(req6) as r6:
    rep = json.loads(r6.read().decode())
    print('STEP 6: Report Retrieval PASS, score:', rep.get('overall_score'), 'tier:', rep.get('performance_tier'))

# 7. Recruiter Workflow Check
login_data = json.dumps({'email': 'recruiter@gnani.ai', 'password': 'Password123'}).encode()
req7 = urllib.request.Request(f'{base_url}/api/auth/recruiter-login', data=login_data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req7) as r7:
    token = json.loads(r7.read().decode())['token']
    print('STEP 7: Recruiter Auth PASS')

# 8. Recruiter Profile View & Audit Verification
req8 = urllib.request.Request(f'{base_url}/api/candidate/{cid}', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req8) as r8:
    cprof = json.loads(r8.read().decode())
    print('STEP 8: Recruiter Candidate Profile PASS, candidate name:', cprof['candidate']['name'], 'sessions:', len(cprof['sessions']))

req9 = urllib.request.Request(f'{base_url}/api/security/audit-trail', headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req9) as r9:
    aud = json.loads(r9.read().decode())
    print('STEP 9: Recruiter Audit Trail PASS, total logs:', aud['count'])
print('ALL E2E WORKFLOW CHECKS COMPLETED SUCCESSFULLY.')

