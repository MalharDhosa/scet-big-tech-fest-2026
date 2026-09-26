import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase-auth";
import { useSiteConfig, DEFAULT_SITE_CONFIG } from "@/lib/firebase-site-config";
import { PageTransitionLoader } from "@/components/brick/PageTransitionLoader";
import { BrickCard } from "@/components/brick/BrickCard";
import { BrickButton } from "@/components/brick/BrickButton";
import { BrickInput } from "@/components/brick/BrickInput";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "Complete Your Profile — CONVERSE 2K26" }],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, loading } = useAuth();
  const { config: rawConfig, loading: configLoading } = useSiteConfig();
  const navigate = useNavigate();

  const onboardingConfig = {
    ...DEFAULT_SITE_CONFIG.onboarding,
    ...(rawConfig?.onboarding || {}),
    fields: {
      ...DEFAULT_SITE_CONFIG.onboarding.fields,
      ...(rawConfig?.onboarding?.fields || {}),
    },
    collegeOptions: rawConfig?.onboarding?.collegeOptions || DEFAULT_SITE_CONFIG.onboarding.collegeOptions,
  };

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    collegeName: "",
    otherCollege: "",
    branch: "",
    semester: "",
    year: "",
    enrollmentNumber: "",
  });

  // Prefill all available profile fields from user if available (e.g. from offline import)
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.name || "",
        phone: prev.phone || user.phone || "",
        branch: prev.branch || user.branch || "",
        enrollmentNumber: prev.enrollmentNumber || user.enrollmentNumber || "",
        collegeName: prev.collegeName || user.collegeName || "SCET",
      }));
    }
  }, [user]);

  const isPreview = typeof window !== 'undefined' && window.location.search.includes('preview=true');

  // Auth/Onboarding Guard
  useEffect(() => {
    if (!loading && !isPreview) {
      if (!user) {
        navigate({ to: "/" });
      } else if (user.role === 'admin' || user.role === 'master') {
        navigate({ to: "/admin" });
      } else if (user.onboarded) {
        navigate({ to: "/dashboard" });
      }
    }
  }, [user, loading, navigate, isPreview]);

  if (loading || configLoading || (!isPreview && (!user || user.onboarded))) {
    return <PageTransitionLoader />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreview || !user) return;
    const fields = onboardingConfig.fields;

    const actualCollegeName = formData.collegeName === "Other"
      ? (formData.otherCollege.trim() || "Other")
      : formData.collegeName;

    if (
      (fields.name?.required && !formData.name) ||
      (fields.phone?.required && !formData.phone) ||
      (fields.enrollmentNumber?.required && !formData.enrollmentNumber) ||
      (fields.collegeName?.required && !formData.collegeName) ||
      (formData.collegeName === "Other" && fields.collegeName?.required && !formData.otherCollege.trim()) ||
      (fields.branch?.required && !formData.branch) ||
      (fields.year?.required && !formData.year) ||
      (fields.semester?.required && !formData.semester)
    ) {
      setError("Please fill out all required fields completely.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { otherCollege, ...saveData } = formData;
      await updateDoc(doc(db, "users", user.uid), {
        ...saveData,
        enrollmentNumber: (formData.enrollmentNumber || "").trim().toUpperCase(),
        collegeName: actualCollegeName,
        onboarded: true,
      });
      // The useAuth listener will automatically update the user state and trigger the redirect to dashboard
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("Error saving onboarding details:", err);
      setError(err?.message || "Failed to save profile. Please check your network and try again.");
      setSaving(false);
    }
  };

  const selectClassName = "slot-inset w-full rounded-[4px] border-[3px] px-4 py-3.5 font-body text-sm outline-none transition-[box-shadow,border-color] duration-150 border-brick-black bg-[#dcdce2] text-brick-black placeholder:text-brick-black/50 focus:border-brick-yellow focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.4),0_0_0_3px_rgba(255,215,0,0.45)] appearance-none";

  return (
    <main className="min-h-screen bg-brick-blue-deep pt-12 pb-24 md:pt-24 px-5">
      <div className="mx-auto max-w-lg">
        <BrickCard surface="white" studs={4} className="snap-in px-6 py-8 md:px-10 md:py-10">
          <div className="text-center">
            <span className="inline-block rounded-[4px] border-[3px] border-brick-black bg-brick-yellow px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-brick-black brick-bevel-sm">
              Step 01
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold uppercase md:text-3xl">
              {onboardingConfig.pageTitle}
            </h1>
            {onboardingConfig.importantNote && (
              <div className="mt-4 rounded border-l-4 border-brick-red bg-brick-red/10 p-3 text-left">
                <p className="font-body text-xs font-semibold text-brick-red md:text-sm">
                  IMPORTANT: {onboardingConfig.importantNote}
                </p>
              </div>
            )}
            <p className="mt-3 font-body text-sm text-brick-black/60">
              Welcome to CONVERSE 2K26! We need a few more details to assemble your Builder ID.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <BrickInput
              label={onboardingConfig.fields.name.label + (onboardingConfig.fields.name.required ? " *" : "")}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required={onboardingConfig.fields.name.required}
            />
            <BrickInput
              label={onboardingConfig.fields.phone.label + (onboardingConfig.fields.phone.required ? " *" : "")}
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required={onboardingConfig.fields.phone.required}
            />
            <BrickInput
              label={onboardingConfig.fields.enrollmentNumber.label + (onboardingConfig.fields.enrollmentNumber.required ? " *" : "")}
              value={formData.enrollmentNumber}
              onChange={(e) => setFormData({ ...formData, enrollmentNumber: e.target.value.toUpperCase() })}
              className="uppercase"
              required={onboardingConfig.fields.enrollmentNumber.required}
            />

            {/* College Name Selection */}
            <div className="flex w-full flex-col gap-2">
              <label className="font-display text-xs sm:text-[13px] font-bold uppercase tracking-[0.14em] text-brick-black/85">
                {onboardingConfig.fields.collegeName?.label || "College Name"} {onboardingConfig.fields.collegeName?.required && "*"}
              </label>
              <div className="relative">
                <select
                  className={selectClassName}
                  value={formData.collegeName}
                  onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })}
                  required={onboardingConfig.fields.collegeName?.required}
                >
                  <option value="" disabled>Select College</option>
                  {(onboardingConfig.collegeOptions || ["SCET", "Other"]).map((college) => (
                    <option key={college} value={college}>{college}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* If "Other" is chosen, let the user specify their college */}
            {formData.collegeName === "Other" && (
              <BrickInput
                label="Specify College Name *"
                placeholder="Enter your college or institute name"
                value={formData.otherCollege}
                onChange={(e) => setFormData({ ...formData, otherCollege: e.target.value })}
                required={onboardingConfig.fields.collegeName?.required}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex w-full flex-col gap-2">
                <label className="font-display text-xs sm:text-[13px] font-bold uppercase tracking-[0.14em] text-brick-black/85">
                  {onboardingConfig.fields.branch?.label || "Branch"} {onboardingConfig.fields.branch?.required && "*"}
                </label>
                <div className="relative">
                  <select
                    className={selectClassName}
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    required={onboardingConfig.fields.branch?.required}
                  >
                    <option value="" disabled>Select</option>
                    {(onboardingConfig.branchOptions || ["IT", "AIDS", "MCA", "ROBOTICS", "CO", "EC", "MECH", "CIVIL", "CHEM", "IC", "TT"]).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2">
                <label className="font-display text-xs sm:text-[13px] font-bold uppercase tracking-[0.14em] text-brick-black/85">
                  {onboardingConfig.fields.year?.label || "Year"} {onboardingConfig.fields.year?.required && "*"}
                </label>
                <div className="relative">
                  <select
                    className={selectClassName}
                    value={formData.year}
                    onChange={(e) => {
                      const year = e.target.value;
                      setFormData({ ...formData, year });
                    }}
                    required={onboardingConfig.fields.year?.required}
                  >
                    <option value="" disabled>Select</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2">
              <label className="font-display text-xs sm:text-[13px] font-bold uppercase tracking-[0.14em] text-brick-black/85">
                {onboardingConfig.fields.semester?.label || "Semester"} {onboardingConfig.fields.semester?.required && "*"}
              </label>
              <div className="relative">
                <select
                  className={selectClassName}
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  required={onboardingConfig.fields.semester?.required}
                >
                  <option value="" disabled>Select</option>
                  {formData.year === "1" && (
                    <>
                      <option value="1">1st Sem</option>
                      <option value="2">2nd Sem</option>
                    </>
                  )}
                  {formData.year === "2" && (
                    <>
                      <option value="3">3rd Sem</option>
                      <option value="4">4th Sem</option>
                    </>
                  )}
                  {formData.year === "3" && (
                    <>
                      <option value="5">5th Sem</option>
                      <option value="6">6th Sem</option>
                    </>
                  )}
                  {formData.year === "4" && (
                    <>
                      <option value="7">7th Sem</option>
                      <option value="8">8th Sem</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {error && (
              <p className="font-body text-sm text-brick-red">
                {error}
              </p>
            )}

            <BrickButton variant="yellow" type="submit" size="lg" className="mt-4" disabled={saving}>
              {saving ? "Saving..." : "Save Profile & Continue"}
            </BrickButton>
          </form>
        </BrickCard>
      </div>
    </main>
  );
}
