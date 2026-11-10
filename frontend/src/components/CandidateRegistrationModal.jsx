import React, { useState } from 'react';
import { User, Mail, Phone, Briefcase, GraduationCap, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

export const CandidateRegistrationModal = ({
  selectedRole,
  onRegisterComplete,
  onCancel,
  initialMode = 'company'
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Mid-Level (2-5 yrs)');
  const [institution, setInstitution] = useState('');
  const [consentAcknowledged, setConsentAcknowledged] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setErrorMsg("Please provide a valid email address.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      setErrorMsg("Please provide a valid contact phone number.");
      return;
    }
    if (!consentAcknowledged) {
      setErrorMsg("You must acknowledge the privacy & assessment protocol.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role_id: selectedRole?.id || 'python-fullstack',
        role_title: selectedRole?.title || 'Software Engineer',
        experience_level: experienceLevel,
        institution: institution.trim(),
        interview_type: initialMode
      };

      const res = await fetch('/api/candidate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Registration submission failed.");
      }

      const resData = await res.json();
      onRegisterComplete({
        candidate_id: resData.candidate_id,
        candidate_name: name.trim(),
        candidate_email: email.trim(),
        candidate_phone: phone.trim(),
        institution: institution.trim(),
        experience_level: experienceLevel
      });
    } catch (err) {
      setErrorMsg(err.message || "Could not register candidate details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto saas-card p-6 md:p-8 space-y-6 animate-fadeIn">
      <div className="border-b border-[#E2E8F0] pb-4">
        <h2 className="text-lg font-bold text-[#172B45] tracking-tight">
          Candidate Registration & Personal Details
        </h2>
        <p className="text-xs text-[#64748B] mt-1">
          Please provide your identity information before proceeding to the technical assessment.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[#172B45] block mb-1">Full Legal Name *</label>
          <div className="relative">
            <User className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ananya Sen"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-[#E2E8F0] text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-[#172B45] block mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ananya@example.com"
                className="w-full pl-9 pr-3 py-2 rounded-md border border-[#E2E8F0] text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#172B45] block mb-1">Phone Number *</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-9 pr-3 py-2 rounded-md border border-[#E2E8F0] text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-[#172B45] block mb-1">Applying For Role</label>
            <input
              type="text"
              value={selectedRole?.title || 'Software Engineer'}
              readOnly
              className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#64748B]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#172B45] block mb-1">Experience Level</label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] bg-white text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
            >
              <option>Fresher / Graduate</option>
              <option>Junior (1-2 yrs)</option>
              <option>Mid-Level (2-5 yrs)</option>
              <option>Senior (5+ yrs)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[#172B45] block mb-1">Current Company or College (Optional)</label>
          <div className="relative">
            <GraduationCap className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. BITS Pilani or TechCorp Labs"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-[#E2E8F0] text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-start gap-2.5 text-xs text-[#172B45] cursor-pointer">
            <input
              type="checkbox"
              checked={consentAcknowledged}
              onChange={(e) => setConsentAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-[#CBD5E1] text-[#315C8C]"
            />
            <span className="text-[#64748B] leading-relaxed">
              I consent to microphone voice evaluation and proctored assessment telemetry under the company recruitment policy.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary text-xs"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <span>{isSubmitting ? 'Registering...' : 'Confirm & Proceed'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

