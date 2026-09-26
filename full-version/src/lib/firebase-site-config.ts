import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type SiteConfig = {
  landing: {
    tagline: string;
    theme: string;
    datePill: string;
    festStartDate: string;
    sponsorsTitle: string;
    sponsorsEnabled: boolean;
    sponsors: { name: string; url: string; color: string; desc: string }[];
  };
  dashboard: {
    tagline: string;
    heroDesc: string;
    buildBoxTitle: string;
    buildBoxDesc: string;
    exploreTitle: string;
    exploreEnabled?: boolean;
    explorePillars: { title: string; desc: string; accent: string; brickColor: string }[];
  };
  events: {
    pageTitle: string;
    pageDesc: string;
  };
  profile: {
    pageTitle: string;
    pageDesc: string;
  };
  about: {
    pageTitle: string;
    pageDesc: string;
    paragraph1: string;
    paragraph2: string;
    instagramUrl: string;
    whatsappUrl: string;
  };
  onboarding: {
    pageTitle: string;
    importantNote: string;
    fields: {
      name: { label: string; required: boolean };
      phone: { label: string; required: boolean };
      enrollmentNumber: { label: string; required: boolean };
      collegeName: { label: string; required: boolean };
      branch: { label: string; required: boolean };
      year: { label: string; required: boolean };
      semester: { label: string; required: boolean };
    };
    collegeOptions: string[];
    branchOptions: string[];
  };
  footer: {
    hodTitle: string;
    hodName: string;
    facultyTitle: string;
    facultyCoordinators: string[];
    studentHeadsTitle: string;
    studentHeads: { name: string; phone: string }[];
    instagramUrl: string;
    designedByText: string;
    copyrightText: string;
  };
  reminderSettings: {
    enabled: boolean;
    leadTimeMinutes: number;
    dailyReminderEnabled: boolean;
    dailyReminderTime: string;
    calendarTitlePrefix: string;
    calendarDescriptionTemplate: string;
    autoOpenCalendarOnRegister: boolean;
  };
  team?: TeamPageConfig;
};

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  photo?: string;
  bio?: string;
  fact?: string;
  linkedin?: string;
  instagram?: string;
  github?: string;
  phone?: string;
  email?: string;
  enrollment?: string;
  year?: string;
  div?: string;
  standing?: string;
}

export interface TeamCategory {
  id: string;
  name: string;
  color: "red" | "yellow" | "blue" | "black" | "gray" | "purple" | "emerald";
  description?: string;
  members: TeamMember[];
}

export interface TeamPageConfig {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaEnabled?: boolean;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonText: string;
  ctaButtonLink: string;
  categories: TeamCategory[];
}

export type ReminderSettings = SiteConfig["reminderSettings"];

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  landing: {
    tagline: "Where Technology Meets Creativity",
    theme: "Beyond Intelligence / Responsible Use of AI",
    datePill: "SCET Tech Fest · 26-27 April 2K26",
    festStartDate: "2026-04-26T09:00:00",
    sponsorsTitle: "POWERED BY OUR AMAZING SPONSORS",
    sponsorsEnabled: true,
    sponsors: [
      { name: "AI Matrix", url: "", color: "#C91A09", desc: "AI-powered solutions" },
      { name: "CyberDefenders", url: "", color: "#E8B800", desc: "Securing the digital frontier" },
      { name: "CloudBricks", url: "", color: "#0055BF", desc: "Cloud infrastructure" },
      { name: "LogicForge", url: "", color: "#1b1b1b", desc: "Engineering excellence" },
    ],
  },
  dashboard: {
    tagline: "Where Technology Meets Creativity",
    heroDesc: "Challenge yourself, compete with the best, build something amazing, and experience technology beyond the classroom.",
    buildBoxTitle: "Build your day.",
    buildBoxDesc: "Explore challenges, register in a few clicks, and keep your schedule in one place.",
    exploreTitle: "WHAT'S ON YOUR BUILD PLAN?",
    exploreEnabled: true,
    explorePillars: [
      {
        title: "Compete",
        desc: "High-stakes coding sprints, rapid quizzes, and algorithmic challenges against the sharpest minds.",
        accent: "var(--brick-yellow)",
        brickColor: "#FFD700",
      },
      {
        title: "Create",
        desc: "Architect resilient cloud systems, craft brand identities, and write elegant software from scratch.",
        accent: "var(--brick-blue)",
        brickColor: "#0055BF",
      },
      {
        title: "Collaborate",
        desc: "Form multi-disciplinary squads across AIDS, IT, CO, and engineering wings to ideate and win.",
        accent: "var(--brick-red)",
        brickColor: "#C91A09",
      },
      {
        title: "Conquer",
        desc: "Win prestigious trophies, earn up to 50 college credits, and gain recognition for your department.",
        accent: "var(--brick-yellow)",
        brickColor: "#FFD700",
      },
    ],
  },
  events: {
    pageTitle: "Sub-Events & Challenges",
    pageDesc: "Browse and register for the available challenges. Choose your track and start building.",
  },
  profile: {
    pageTitle: "Builder Profile",
    pageDesc: "Manage your builder identity, view your registered events, and check your status.",
  },
  about: {
    pageTitle: "About Us",
    pageDesc: "Discover the minds behind CONVERSE 2K26.",
    paragraph1: "CONVERSE is the flagship technical festival of SCET, bringing together the brightest minds across departments to build, compete, and innovate.",
    paragraph2: "Hosted collaboratively by the IT and AIDS departments, our mission is to foster a culture of responsible AI usage and technological excellence.",
    instagramUrl: "https://instagram.com/converseitaids",
    whatsappUrl: "https://chat.whatsapp.com/EzV0MybDcYdG8kYBEG9D32",
  },
  onboarding: {
    pageTitle: "Complete Your Profile",
    importantNote: "Please add details carefully as the name will be exactly the same in the certificate.",
    fields: {
      name: { label: "Full Name", required: true },
      phone: { label: "Phone Number", required: true },
      enrollmentNumber: { label: "Enrollment Number", required: true },
      collegeName: { label: "College Name", required: true },
      branch: { label: "Branch", required: true },
      year: { label: "Year", required: true },
      semester: { label: "Semester", required: true },
    },
    collegeOptions: ["SCET", "Other"],
    branchOptions: ["IT", "AIDS", "MCA", "ROBOTICS", "CO", "EC", "MECH", "CIVIL", "CHEM", "IC", "TT"],
  },
  footer: {
    hodTitle: "Head of Department",
    hodName: "Dr. Mita Parikh",
    facultyTitle: "Faculty Coordinators",
    facultyCoordinators: [
      "Dr. Vivek Champaneria",
      "Dr. Vibha Patel",
      "Prof. Bhumika Shah",
    ],
    studentHeadsTitle: "Student Heads",
    studentHeads: [
      { name: "Bhavya Ladumor", phone: "8200437474" },
      { name: "Farshaz Master", phone: "7283930268" },
      { name: "Twisha Savani", phone: "9723596171" },
    ],
    instagramUrl: "https://instagram.com/converseitaids",
    designedByText: "Designed & Developed by Malhar Balar and Harsh Gajera",
    copyrightText: "© Converse 2026. All Rights Reserved",
  },
  reminderSettings: {
    enabled: true,
    leadTimeMinutes: 60,
    dailyReminderEnabled: true,
    dailyReminderTime: "09:00",
    calendarTitlePrefix: "CONVERSE 2K26: ",
    calendarDescriptionTemplate: "Official CONVERSE 2K26 SCET Tech Fest Event. Please report 15 minutes before event start with your QR entry pass.",
    autoOpenCalendarOnRegister: true,
  },
  team: {
    heroEyebrow: "MEET THE CREW",
    heroTitle: "The builders behind every event",
    heroSubtitle: "None of this happens by accident. Every workshop, every stage, every late night before an event — it's this team piecing it together, brick by brick.",
    ctaEnabled: true,
    ctaTitle: "Want to help build the next one?",
    ctaSubtitle: "We're always looking for hands who care about doing things properly. No experience required — just show up.",
    ctaButtonText: "Join the crew →",
    ctaButtonLink: "https://chat.whatsapp.com/EzV0MybDcYdG8kYBEG9D32",
    categories: [
    {
        "id": "hod-faculty",
        "name": "Leadership & Faculty",
        "color": "red",
        "description": "Department leadership and mentoring professors guiding CONVERSE 2K26.",
        "members": [
            {
                "id": "mita-parikh",
                "name": "Dr. Mita Parikh",
                "role": "Head of Department",
                "photo": "",
                "bio": "Head of Information Technology & Artificial Intelligence & Data Science at SCET.",
                "fact": "Championing responsible AI and engineering excellence across SCET."
            },
            {
                "id": "vivek-champaneria",
                "name": "Dr. Vivek Champaneria",
                "role": "Faculty Coordinator",
                "photo": "",
                "bio": "Senior faculty driving academic innovation and technical mentorship.",
                "fact": "Guiding student hackathons and research initiatives for over a decade."
            },
            {
                "id": "bhumika-shah",
                "name": "Prof. Bhumika Shah",
                "role": "Faculty Coordinator",
                "photo": "",
                "bio": "Faculty mentor coordinating flagship challenges and institutional tie-ups.",
                "fact": "Always ensuring smooth event execution and student support."
            },
            {
                "id": "vibha-patel",
                "name": "Dr. Vibha Patel",
                "role": "Faculty Coordinator",
                "photo": "",
                "bio": "Faculty mentor fostering student innovation and technical competitions.",
                "fact": "Key pillar of student technical council activities."
            }
        ]
    },
    {
        "id": "student-heads",
        "name": "Student Heads & Overall Leads",
        "color": "yellow",
        "description": "Overall student lead coordinators orchestrating all tracks, teams, and fest operations.",
        "members": [
            {
                "id": "twisha-savani-student-heads",
                "name": "Twisha Savani",
                "role": "Student Head",
                "photo": "",
                "bio": "The graceful powerhouse and heartbeat of festival operations. Twisha effortlessly synchronizes dozens of committees, stages, and hundreds of participants with unmatched calm and infectious positivity.",
                "fact": "Can resolve three simultaneous logistical emergencies with a smile while greeting keynote guests at the gate.",
                "phone": "+91 9723596171",
                "email": "twishasavani.it23d2@scet.ac.in",
                "enrollment": "ET23Btit124",
                "year": "4th Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "bhavya-ladumor-student-heads",
                "name": "Bhavya Ladumor",
                "role": "Student Head",
                "photo": "",
                "bio": "Visionary student lead whose relentless drive, warmth, and operational excellence keep the entire CONVERSE festival running like a well-oiled machine. Bhavya leads by example from sunrise to midnight.",
                "fact": "Known across SCET for keeping a 3-day multi-track festival schedule synchronized down to the exact second.",
                "phone": "+91 8200437474",
                "email": "bhavyaladumor.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT076",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "farshaz-master-student-heads",
                "name": "Farshaz Master",
                "role": "Student Head",
                "photo": "",
                "bio": "The ultimate ambassador and strategist of CONVERSE. Farshaz bridges student energy with premier institutional alliances, turning ambitious festival dreams into tangible realities.",
                "fact": "Can pitch the magic and vision of CONVERSE in 60 seconds flat and walk away with everyone's full support.",
                "phone": "+91 7283990268",
                "email": "masterfarshaz.aids24@scet.ac.in",
                "enrollment": "ET24BTAI011",
                "year": "3rd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "tech-development",
        "name": "Website & Tech Development",
        "color": "blue",
        "description": "Engineers and builders of the official CONVERSE 2K26 digital platform.",
        "members": [
            {
                "id": "malhar-balar-tech-development",
                "name": "Malhar Balar",
                "role": "Website & Tech Development Head",
                "photo": "",
                "bio": "Full-stack architect and digital wizard of CONVERSE 2K26. Malhar built the high-speed web portal, instant QR ticket scanner, and real-time event infrastructure from the ground up with pure engineering passion.",
                "fact": "Engineered the blazing-fast offline-ready QR check-in scanner over a single caffeine-fueled weekend.",
                "phone": "+91 9372154408",
                "email": "malharbalar.aids25@scet.ac.in",
                "enrollment": "ET25BTAI004",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "https://linkedin.com",
                "instagram": "",
                "github": "https://github.com"
            },
            {
                "id": "harsh-gajera-tech-development",
                "name": "Harsh Gajera",
                "role": "Website & Tech Development Member",
                "photo": "",
                "bio": "Creative frontend specialist and design engineer behind the tactile Lego aesthetics. Harsh crafts fluid animations, pixel-perfect brick components, and responsive experiences that feel satisfying to explore.",
                "fact": "Will happily spend 45 minutes fine-tuning a button shadow and bounce curve just to make it feel extra satisfying.",
                "phone": "+91 9723534447",
                "email": "harshgajera.aids25@scet.ac.in",
                "enrollment": "ET25BTAI015",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "https://linkedin.com",
                "instagram": "",
                "github": "https://github.com"
            }
        ]
    },
    {
        "id": "finance-sponsorship",
        "name": "Finance & Sponsorship",
        "color": "black",
        "description": "Managing fest budgeting, treasury, transactions, and sponsorship relationships.",
        "members": [
            {
                "id": "mann-patel-finance-sponsorship",
                "name": "Mann Patel",
                "role": "Finance Head",
                "photo": "",
                "bio": "The analytical anchor and trusted guardian of CONVERSE's treasury. Mann manages budget allocations, prize disbursements, and transaction audits with razor-sharp accuracy and rock-solid integrity.",
                "fact": "Can balance a complex multi-column festival ledger faster in his head than most can open a spreadsheet.",
                "phone": "+91 7984019228",
                "email": "mannpatel.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT122",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "yug-rajani-finance-sponsorship",
                "name": "Yug Rajani",
                "role": "Finance Head",
                "photo": "",
                "bio": "Financial strategist and registration finance maestro. Yug ensures every spot collection, voucher verification, and budget breakdown is accounted for with zero stress and total transparency.",
                "fact": "Has never had a cash register voucher or digital transaction ledger off by even a single rupee.",
                "phone": "+91 7016593094",
                "email": "yugrajani.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT131",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "aalap-khunt-finance-sponsorship",
                "name": "Aalap Khunt",
                "role": "Volunteer",
                "photo": "",
                "bio": "Dependable finance coordinator managing registration cash flows, verified receipt books, and helpdesk reconciliations with cheerful dedication.",
                "fact": "Keeps his desk voucher stack so meticulously organized that auditing takes less than thirty seconds.",
                "phone": "+91 7984151523",
                "email": "aalapkhunt.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT094",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "megh-patel-finance-sponsorship",
                "name": "Megh Patel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Pragmatic finance specialist handling vendor settlements, winner stage prize documentation, and institutional account checks.",
                "fact": "Remains unflappably calm, cheerful, and focused even during the busiest registration rushes of the fest.",
                "phone": "+91 9998652065",
                "email": "meghpatel.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT115",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "marketing-registration",
        "name": "Marketing & Registration",
        "color": "red",
        "description": "Driving participant outreach, campus ambassadorship, and registration helpdesks.",
        "members": [
            {
                "id": "hasti-moradia-marketing-registration",
                "name": "Hasti Moradia",
                "role": "Marketing Head",
                "photo": "",
                "bio": "The magnetic spark plug and powerhouse of festival outreach. Hasti's vibrant charisma, persuasive charm, and boundless enthusiasm turn casual hallway chats into instant team registrations.",
                "fact": "Could pitch a competitive tech track to someone without a laptop and have them enthusiastically signing up.",
                "phone": "+91 9909334374",
                "email": "hastimoradia.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT086",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "diyora-yana-niteshbhai-marketing-registration",
                "name": "Diyora Yana Niteshbhai",
                "role": "Volunteer",
                "photo": "",
                "bio": "Warm, energetic marketing dynamo championing classroom presentations, crowd engagement, and the primary registration helpdesk.",
                "fact": "Her welcoming smile and encyclopedic event knowledge make first-year students instantly feel at home.",
                "phone": "+91 9664990759",
                "email": "yanadiyora.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT079",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "nariya-zarna-ketankumar-marketing-registration",
                "name": "Nariya Zarna Ketankumar",
                "role": "Volunteer",
                "photo": "",
                "bio": "Enthusiastic outreach coordinator guiding students across departments, answering rulebook questions, and driving team sign-ups.",
                "fact": "Knows every event prerequisite and timing by heart, answering queries before students even finish asking.",
                "phone": "+91 8200993144",
                "email": "Zarnanariya.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT107",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "prietesh-ratilal-patil-marketing-registration",
                "name": "Prietesh Ratilal Patil",
                "role": "Volunteer",
                "photo": "",
                "bio": "Dynamic campus connector ensuring every hostel, batch, and division is hyped and ready for the flagship challenges.",
                "fact": "Has a legendary talent for rallying entire classroom groups to sign up together within minutes.",
                "phone": "+91 9723422109",
                "email": "",
                "enrollment": "ET25BTAI041",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "dhruhi-sachinkumar-modh-marketing-registration",
                "name": "Dhruhi Sachinkumar Modh",
                "role": "Volunteer",
                "photo": "",
                "bio": "Helpdesk specialist managing the on-ground participant flow, pass issuance, and registration verify queues with effortless poise.",
                "fact": "Keeps registration queue lines moving smoothly with quick hands and a genuinely positive attitude.",
                "phone": "+91 7433833757",
                "email": "",
                "enrollment": "ET25BTAI029",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "social-media",
        "name": "Social Media & Content Writing",
        "color": "emerald",
        "description": "Crafting digital presence, festival reels, broadcast coverage, and engaging narratives.",
        "members": [
            {
                "id": "nandani-thakkar-social-media",
                "name": "Nandani Thakkar",
                "role": "Head",
                "photo": "",
                "bio": "Creative wordsmith and digital storyteller shaping the voice of CONVERSE. Nandani crafts viral hooks, engaging festival narratives, and captions that capture the true spirit of SCET.",
                "fact": "Can draft an evocative festival story and a trending reel caption while walking up the department stairs.",
                "phone": "+91 7863829506",
                "email": "nandanithakkar.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT136",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "rudra-godhani-social-media",
                "name": "Rudra Godhani",
                "role": "Head",
                "photo": "",
                "bio": "Visual trendsetter and content director capturing raw campus energy, candid moments, and electrifying stage announcements with cinematic style.",
                "fact": "Has a sixth sense for trending reel audios and always catches the best candid crowd celebrations on camera.",
                "phone": "+91 9512607383",
                "email": "rudragodhani.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT081",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "mahek-parmar-social-media",
                "name": "Mahek Parmar",
                "role": "Head",
                "photo": "",
                "bio": "Master of narrative pacing and festival communications. Mahek turns complex schedule updates and technical briefs into crisp, exciting announcements.",
                "fact": "Can turn a dense 10-point rulebook into a captivating social broadcast in five minutes flat.",
                "phone": "+91 8511896079",
                "email": "mahekparmar.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT106",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "namra-saliya-social-media",
                "name": "Namra Saliya",
                "role": "Volunteer",
                "photo": "",
                "bio": "High-energy social runner posting live story updates, participant highlights, and lightning-fast winner reveals throughout the fest.",
                "fact": "Fastest thumbs in the team when publishing live round updates and backstage winner selfies.",
                "phone": "+91 7984604475",
                "email": "namrasaliya.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT133",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "prajapati-aryan-rajeshkumar-social-media",
                "name": "Prajapati Aryan Rajeshkumar",
                "role": "Volunteer",
                "photo": "",
                "bio": "Dedicated content creator capturing the buzz, crowd cheers, and festival highlights with polished copywriting.",
                "fact": "Possesses an eagle eye for clean typography, crisp wording, and engaging countdowns.",
                "phone": "+91 8799494778",
                "email": "aryanparajapati.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT130",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "stuti-kanani-social-media",
                "name": "Stuti Kanani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Heartfelt storyteller gathering participant testimonials, coordinator spotlights, and behind-the-scenes moments that celebrate student teamwork.",
                "fact": "Known for writing festival recap reflections that make the entire organizing committee tear up with pride.",
                "phone": "+91 9427896162",
                "email": "stutikanani.it24d2@scet.ac.in",
                "enrollment": "ET25BTIT815",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "harsh-modh-social-media",
                "name": "Harsh Modh",
                "role": "Volunteer",
                "photo": "",
                "bio": "Freshman powerhouse monitoring live attendee feedback, social DMs, and community vibes with non-stop enthusiasm.",
                "fact": "First-year trailblazer with a natural instinct for viral student memes and relatable tech humor.",
                "phone": "+91 6355309481",
                "email": "harshmodh.it26d2@scet.ac.in",
                "enrollment": "133",
                "year": "1st Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "harshita-agarwal-social-media",
                "name": "Harshita Agarwal",
                "role": "Volunteer",
                "photo": "",
                "bio": "Creative content strategist designing interactive Instagram stories, poll quizzes, and festival trivia that keep attendees hooked.",
                "fact": "Turns standard timetable announcements into interactive story games that boost engagement tenfold.",
                "phone": "+91 6359432117",
                "email": "harshitaagarwal.aids25@scet.ac.in",
                "enrollment": "ET25BTAI002",
                "year": "2nd Year",
                "div": "IT-3",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "prachi-patel-social-media",
                "name": "Prachi Patel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Social media coordinator curating aesthetic photo carousels, sponsor thank-yous, and festival countdown highlights.",
                "fact": "Keeps the festival Instagram grid looking like a pristine, color-coordinated design portfolio.",
                "phone": "+91 9274224939",
                "email": "prachipatel.aids25@scet.ac.in",
                "enrollment": "ET25BTAI038",
                "year": "2nd Year",
                "div": "IT-3",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "shreya-ganeshwala-social-media",
                "name": "Shreya Ganeshwala",
                "role": "Volunteer",
                "photo": "",
                "bio": "On-ground media correspondent capturing live participant reactions, stage cheers, and electric crowd moments.",
                "fact": "Always in the perfect spot right before a triumphant team jumps up in victory celebration.",
                "phone": "+91 9712923107",
                "email": "shreyaganeshwala.aids25@scet.ac.in",
                "enrollment": "ET25BTAI017",
                "year": "2nd Year",
                "div": "IT-3",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "priya-billimoria-social-media",
                "name": "Priya Billimoria",
                "role": "Volunteer",
                "photo": "",
                "bio": "Creative media enthusiast assisting with story broadcasts, highlight reels, and digital engagement sprints.",
                "fact": "Brings radiant optimism and artistic flair that brightens up the entire media control room.",
                "phone": "+91 6355966859",
                "email": "",
                "enrollment": "ET25BTAI042",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "photography",
        "name": "Photography & Media",
        "color": "purple",
        "description": "Capturing high-energy moments, photo walks, stage coverage, and festival memories.",
        "members": [
            {
                "id": "parry-sojitra-photography",
                "name": "Parry Sojitra",
                "role": "Photography Head",
                "photo": "",
                "bio": "Photography lead with a cinematic eye for high-drama stage captures, festival bokeh, and unforgettable campus moments.",
                "fact": "Can capture the golden sunlight streaming through the SCET trees with absolute cinematic perfection.",
                "phone": "+91 9898088233",
                "email": "parrysojitra.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT138",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "rudra-chovatiya-photography",
                "name": "Rudra Chovatiya",
                "role": "Volunteer",
                "photo": "",
                "bio": "Action photographer capturing the intense focus of hackathons, buzzer clashes, and triumphant podium celebrations.",
                "fact": "Never misses the exact millisecond when a winning team's hands go up in celebration.",
                "phone": "+91 7990256887",
                "email": "rudrachovatiya.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT075",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "pranay-gopani-photography",
                "name": "Pranay Gopani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Low-light and stage lighting specialist documenting auditoriums, tech challenge arenas, and crowd energy.",
                "fact": "His shutter clicks are practically synchronized to the bass beat of the festival music.",
                "phone": "+91 9106251693",
                "email": "pranaygopani.it25d2@scet.ac.in",
                "enrollment": "ET24BTIT083",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "graphics-branding",
        "name": "Graphics & Branding",
        "color": "purple",
        "description": "Designing official posters, banners, interactive visual assets, and fest branding.",
        "members": [
            {
                "id": "dhwani-athaviya-graphics-branding",
                "name": "Dhwani Athaviya",
                "role": "Graphics Head",
                "photo": "",
                "bio": "Visual visionary whose artistic brilliance defined the bold Lego aesthetic, posters, badges, and backdrops of CONVERSE 2K26.",
                "fact": "Can design an iconic, balanced event poster with bespoke typography in the time it takes to brew coffee.",
                "phone": "+91 8849442439",
                "email": "dhwaniathaviya.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT073",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "harshi-tandel-graphics-branding",
                "name": "Harshi Tandel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Gifted graphic designer creating vivid social carousels, event identity badges, and certificates with artistic finesse.",
                "fact": "Master of playful color harmony who can balance contrasting Lego tones with effortless grace.",
                "phone": "+91 6359366644",
                "email": "harshitandel.it25d1@scet.ac.in",
                "enrollment": "ET25BTIT015",
                "year": "2nd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "dhruvi-patel-graphics-branding",
                "name": "Dhruvi Patel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Visual artist crafting participant digital passes, track signage, and iconography with obsessive precision.",
                "fact": "Has an instinct for millimeter-perfect alignment and vibrant modern tech aesthetics.",
                "phone": "+91 9409057438",
                "email": "dhruvipatel.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT115",
                "year": "2nd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "riya-katyare-graphics-branding",
                "name": "Riya Katyare",
                "role": "Volunteer",
                "photo": "",
                "bio": "Senior design talent developing banner assets, stage presentations, and festival branding collateral with modern polish.",
                "fact": "Brings sophisticated editorial elegance to complex technical track infographics.",
                "phone": "+91 9328053003",
                "email": "riyakatyare.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT092",
                "year": "3rd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "vanshika-koshiya-graphics-branding",
                "name": "Vanshika Koshiya",
                "role": "Volunteer",
                "photo": "",
                "bio": "Creative illustrator designing large-scale print banners, sponsor lockups, and vibrant festival emblems.",
                "fact": "Knows every print resolution pitfall and ensures every banner looks razor-sharp from any distance.",
                "phone": "+91 8758844151",
                "email": "vanshikakoshiya.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT093",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "yashvi-bhatt-graphics-branding",
                "name": "Yashvi Bhatt",
                "role": "Volunteer",
                "photo": "",
                "bio": "Design artist transforming festival concepts into captivating vector artwork and social story graphics.",
                "fact": "Specializes in vector illustrations that bring friendly, approachable energy to complex tech events.",
                "phone": "+91 9712701131",
                "email": "yashvibhatt.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT075",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "vigna-patel-graphics-branding",
                "name": "Vigna Patel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Brand consistency specialist ensuring all print and digital graphics adhere to the authentic CONVERSE visual system.",
                "fact": "Can spot a 1-pixel font misalignment or an uncalibrated CMYK swatch from across the hall.",
                "phone": "+91 9898124047",
                "email": "vignapatel.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT119",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "decoration",
        "name": "Decoration & Creative Design",
        "color": "yellow",
        "description": "Building immersive Lego-themed physical installations, stage backdrops, and campus aesthetics.",
        "members": [
            {
                "id": "mahek-sasani-dineshbhai-decoration",
                "name": "Mahek Sasani Dineshbhai",
                "role": "Decoration Head",
                "photo": "",
                "bio": "Creative mastermind who transformed the SCET campus into a real-world Lego wonderland with monumental handcrafted installations.",
                "fact": "Can turn humble cardboard, insulation foam, and bright paint into lifelike giant Lego sculptures in a single night.",
                "phone": "+91 9274487625",
                "email": "",
                "enrollment": "ET25BTIT135",
                "year": "2nd Year",
                "div": "",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "mahek-sasani-decoration",
                "name": "Mahek Sasani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Artistic builder leading the fabrication of stage backdrops, interactive photo frames, and hallway brick arches.",
                "fact": "Master craftsperson behind the iconic selfie photo frames that hundreds of students pose with.",
                "phone": "+91 9274487625",
                "email": "maheksasani.it25d2@scet.ac.in",
                "enrollment": "",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "tulsi-devani-decoration",
                "name": "Tulsi Devani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Hands-on builder assembling life-sized Lego block replicas, colorful stage pedestals, and decorative banners.",
                "fact": "Can measure, cut, and wrap 50 precision giant Lego bricks before lunch break without breaking a sweat.",
                "phone": "+91 6356776108",
                "email": "tulsidevani.it25d2@scet.ac.in",
                "enrollment": "",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "kesha-shah-decoration",
                "name": "Kesha Shah",
                "role": "Volunteer",
                "photo": "",
                "bio": "Aesthetic coordinator bringing warmth, artistic lighting accents, and vibrant color palettes to every venue lobby.",
                "fact": "Brings meticulous care to every corner, making sure every corridor looks festive and welcoming.",
                "phone": "+91 9099010228",
                "email": "keshashah.aids25@scet.ac.in",
                "enrollment": "",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "dhanani-srushti-decoration",
                "name": "Dhanani Srushti",
                "role": "Volunteer",
                "photo": "",
                "bio": "Artistic builder designing corridor wall murals, hanging papercraft installations, and stage greenery accents.",
                "fact": "Master of quick-dry acrylics and zero-waste geometric paper sculptures.",
                "phone": "+91 8469964918",
                "email": "sushtibendhanani.aids25@scet.ac.in",
                "enrollment": "",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "raajvi-patel-decoration",
                "name": "Raajvi Patel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Creative prop engineer styling registration zones, stage podiums, and colorful entrance accents.",
                "fact": "Always has a backup hot-glue gun, zip ties, and heavy-duty tape ready for split-second decor magic.",
                "phone": "+91 8758247159",
                "email": "raajvipatel.aids25@scet.ac.in",
                "enrollment": "",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "misha-dhola-decoration",
                "name": "Misha Dhola",
                "role": "Volunteer",
                "photo": "",
                "bio": "Visionary decorator curating venue atmosphere, entrance archways, and photo op backdrops with playful energy.",
                "fact": "Believes that a tech festival should feel like a colorful, joyous playground of human creativity.",
                "phone": "+91 9925735971",
                "email": "mishadhola.aids25@scet.ac.in",
                "enrollment": "",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "desai-archi-decoration",
                "name": "Desai Archi",
                "role": "Volunteer",
                "photo": "",
                "bio": "Precision builder constructing pixel-art emblems, stage props, and decorative track emblems.",
                "fact": "Brings architectural precision and steady hands to large-scale freehand stage assembly.",
                "phone": "+91 7990208508",
                "email": "archidesai.it25d1@scet.ac.in",
                "enrollment": "",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "aarushi-desai-decoration",
                "name": "Aarushi Desai",
                "role": "Volunteer",
                "photo": "",
                "bio": "Design builder putting the finishing artistic touches on stage backgrounds, auditorium podiums, and entrance lighting.",
                "fact": "Has an infallible eye for symmetry that makes every decorated stage look professionally curated.",
                "phone": "+91 9879533685",
                "email": "aarushidesai.it25d1@scet.ac.in",
                "enrollment": "",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "harshita-agarwal-decoration",
                "name": "Harshita Agarwal",
                "role": "Volunteer",
                "photo": "",
                "bio": "Creative coordinator organizing interactive doodle boards and student celebration signature walls across campus.",
                "fact": "Loves watching students' faces light up when they first walk past the giant Lego entrance gate.",
                "phone": "+91 6359432117",
                "email": "harshitaagarwal.aids25@scet.ac.in",
                "enrollment": "",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "shrina-kheni-decoration",
                "name": "Shrina Kheni",
                "role": "Volunteer",
                "photo": "",
                "bio": "Freshman creative volunteer infusing late-night build sessions with cheerful smiles, bright painting, and boundless energy.",
                "fact": "Her upbeat attitude and quick painting skills kept the entire decoration team laughing through all-night prep.",
                "phone": "+91 7984062747",
                "email": "shrinakheni.aids26@scet.ac.in",
                "enrollment": "",
                "year": "1st Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "yana-nakarani-decoration",
                "name": "Yana Nakarani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Enthusiastic freshman builder helping erect the grand entrance arches, colorful streamers, and stage pedestals.",
                "fact": "Worked tirelessly through the weekend to make sure the campus looked breathtaking the moment gates opened.",
                "phone": "+91 9274889613",
                "email": "yananakaranj.aids26@scet.ac.in",
                "enrollment": "",
                "year": "1st Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "hasti-sheladiya-decoration",
                "name": "Hasti Sheladiya",
                "role": "Volunteer",
                "photo": "",
                "bio": "First-year creative talent hand-painting intricate event logos, directional brick arrows, and stage decals.",
                "fact": "Boasts a remarkably steady hand that paints smooth vector-clean lines on rough cardboard surfaces.",
                "phone": "+91 9913138066",
                "email": "hastisheladiya.aids26@scet.ac.in",
                "enrollment": "",
                "year": "1st Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "prachi-mangukiya-decoration",
                "name": "Prachi Mangukiya",
                "role": "Volunteer",
                "photo": "",
                "bio": "Freshman builder constructing colorful brick pillars and creative photo points that delighted thousands of visitors.",
                "fact": "Always the first to climb the ladder to hang the highest festival bunting with total courage.",
                "phone": "+91 9275242343",
                "email": "prachimangukiya.aids26@scet.ac.in",
                "enrollment": "",
                "year": "1st Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "bhakti-katharotiya-decoration",
                "name": "Bhakti Katharotiya",
                "role": "Volunteer",
                "photo": "",
                "bio": "Freshman artist coordinating color blends, streamer cascades, and workshop toolkits with sunny optimism.",
                "fact": "Keeps the creative workshop organized, safe, and brimming with good music and positive vibes.",
                "phone": "+91 8140156751",
                "email": "bhaktikatharotiya.aids26@scet.ac.in",
                "enrollment": "",
                "year": "1st Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "akshita-vasoya-decoration",
                "name": "Akshita Vasoya",
                "role": "Volunteer",
                "photo": "",
                "bio": "Dedicated first-year builder assisting with award stage dressing, banner rigging, and prop styling.",
                "fact": "Brings a radiant smile and can-do spirit that makes even the heaviest painting tasks feel effortless.",
                "phone": "+91 9213592340",
                "email": "arshitavasoya.aids26@scet.ac.in",
                "enrollment": "",
                "year": "1st Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "event-codathon",
        "name": "Codathon Track",
        "color": "blue",
        "description": "Flagship rapid-fire competitive coding and problem-solving hack arena.",
        "members": [
            {
                "id": "jevin-mangukiya-event-codathon",
                "name": "Jevin Mangukiya",
                "role": "Event Head",
                "photo": "",
                "bio": "The algorithmic mastermind behind Codathon's trickiest challenges. Jevin turns complex edge cases into thrilling competitive showdowns while mentoring emerging coders.",
                "fact": "Can optimize an O(N²) brute-force solution into O(N log N) in his head before his morning chai cools down.",
                "phone": "+91 9023105834",
                "email": "",
                "enrollment": "ET24BTIT091",
                "year": "3rd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "vivek-panchal-event-codathon",
                "name": "Vivek Panchal",
                "role": "Event Head",
                "photo": "",
                "bio": "Competitive coding powerhouse and the calm anchor of the Codathon arena. Vivek crafts airtight problem sets, automated test suites, and fair runtime limits.",
                "fact": "Has solved complex recursive tree puzzles mentally during everyday college lectures for pure fun.",
                "phone": "+91 6353639587",
                "email": "",
                "enrollment": "ET24BTIT104",
                "year": "3rd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "parry-sojitra-event-codathon",
                "name": "Parry Sojitra",
                "role": "Volunteer",
                "photo": "",
                "bio": "Technical lab marshal ensuring every participant's compiler, IDE environment, and network terminal runs at peak performance.",
                "fact": "Can debug obscure C++ segmentation faults and compiler linker errors in under 30 seconds.",
                "phone": "+91 9898088233",
                "email": "",
                "enrollment": "ET25BTIT138",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "prajapati-aryan-rajeshkumar-event-codathon",
                "name": "Prajapati Aryan Rajeshkumar",
                "role": "Volunteer",
                "photo": "",
                "bio": "Vigilant contest monitor keeping time, recording live submission timestamps, and keeping the coding arena focused.",
                "fact": "Maintains a silent, pin-drop lab atmosphere where coders can achieve pure uninterrupted flow state.",
                "phone": "+91 8799494778",
                "email": "",
                "enrollment": "ET25BTIT130",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "kankotiya-harshil-pankajbhai-event-codathon",
                "name": "Kankotiya Harshil Pankajbhai",
                "role": "Volunteer",
                "photo": "",
                "bio": "Problem test engineer validating input constraints, corner cases, and sample test outputs for competitive fairness.",
                "fact": "His first move when reading any coding problem is finding the hidden zero-case that breaks most solutions.",
                "phone": "+91 9316561338",
                "email": "",
                "enrollment": "ET25BTIT092",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "pranay-gopani-event-codathon",
                "name": "Pranay Gopani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Arena coordinator managing contestant check-ins, lab seating arrangements, and live leaderboard sync.",
                "fact": "Ensures that every single competitor feels welcomed, supported, and ready to code their best.",
                "phone": "",
                "email": "",
                "enrollment": "",
                "year": "",
                "div": "",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "khunt-tirth-event-codathon",
                "name": "Khunt Tirth",
                "role": "Volunteer",
                "photo": "",
                "bio": "Hardware and terminal specialist resolving keyboard snags, terminal credentials, and live problem distribution instantly.",
                "fact": "Always keeps three backup mice and pre-configured terminal logins ready on his desk.",
                "phone": "+91 9726304478",
                "email": "",
                "enrollment": "ET25BTIT095",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "diyora-yana-niteshbhai-event-codathon",
                "name": "Diyora Yana Niteshbhai",
                "role": "Volunteer",
                "photo": "",
                "bio": "Logistical coordinator managing competitor registration lists, desk numbers, and round transition announcements.",
                "fact": "Her reassuring presence eases the nerves of first-time hackathon competitors before the timer begins.",
                "phone": "+91 9664990759",
                "email": "",
                "enrollment": "ET25BTIT079",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "nariya-zarna-ketankumar-event-codathon",
                "name": "Nariya Zarna Ketankumar",
                "role": "Volunteer",
                "photo": "",
                "bio": "Score auditor verifying test results, tie-breaker criteria, and finalist qualifications with meticulous care.",
                "fact": "Double-checks every single submission millisecond so no team ever loses on a clerical technicality.",
                "phone": "+91 8200993144",
                "email": "",
                "enrollment": "ET25BTIT107",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "hasti-moradia-event-codathon",
                "name": "Hasti Moradia",
                "role": "Volunteer",
                "photo": "",
                "bio": "Arena motivator keeping competitor spirits high, coordinating stage awards, and guiding finalists to the judging desk.",
                "fact": "Brings electric encouragement that keeps contestants motivated through grueling multi-hour coding sprints.",
                "phone": "+91 9909334374",
                "email": "",
                "enrollment": "ET25BTIT086",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "event-it-quiz",
        "name": "IT Quiz Track",
        "color": "yellow",
        "description": "High-octane tech trivia, algorithm puzzles, and computing history buzzer rounds.",
        "members": [
            {
                "id": "krish-nikibhai-khambhati-event-it-quiz",
                "name": "Krish Nikibhai Khambhati",
                "role": "Event Head",
                "photo": "",
                "bio": "Charismatic quizmaster with an encyclopedic memory of tech history, CPU milestones, and modern software legends. Krish turns trivia into an electrifying arena.",
                "fact": "Can recite every major computing breakthrough from Turing to quantum computing off the top of his head.",
                "phone": "+91 9724757148",
                "email": "krishkhambhati.it25d1@scet.ac.in",
                "enrollment": "ET25BTIT022",
                "year": "2nd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "pasikanti-adarsh-ramkrishna-event-it-quiz",
                "name": "Pasikanti Adarsh Ramkrishna",
                "role": "Event Head",
                "photo": "",
                "bio": "Quiz architect engineering brainteasers, audio-visual puzzle rounds, and obscure technology riddles that test true mastery.",
                "fact": "Loves dropping mind-bending trivia questions about hidden developer easter eggs and forgotten OS prototypes.",
                "phone": "+91 8160796177",
                "email": "adarshpasikanti.aids24@scet.ac.in",
                "enrollment": "ET24BTAI038",
                "year": "3rd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "desai-archi-event-it-quiz",
                "name": "Desai Archi",
                "role": "Event Head",
                "photo": "",
                "bio": "Stage technical director orchestrating buzzer consoles, live question projections, and tie-breaking speedruns.",
                "fact": "Operates the digital buzzer board with lightning reflexes, spotting fractions of a second differences effortlessly.",
                "phone": "+91 7990208508",
                "email": "archidesai.it25d1@scet.ac.in",
                "enrollment": "ET25BTIT010",
                "year": "2nd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "vedika-raghvani-event-it-quiz",
                "name": "Vedika Raghvani",
                "role": "Event Head",
                "photo": "",
                "bio": "Dynamic co-host and audience quiz director whose stage presence keeps the entire auditorium cheering and buzzing.",
                "fact": "Has a natural gift for building dramatic suspense before revealing correct answers on stage.",
                "phone": "+91 6355541124",
                "email": "vedikaraghvani.it24d1@scet.ac.in",
                "enrollment": "ET25BTIT808",
                "year": "3rd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "pari-s-sanghani-event-it-quiz",
                "name": "Pari S Sanghani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Meticulous scorekeeper updating live team point tallies, penalties, and rapid-fire round bonuses with total accuracy.",
                "fact": "Keeps live team scoreboards updated so quickly that the audience sees points before the speaker finishes talking.",
                "phone": "+91 8780087923",
                "email": "Parisanghani.it25d2@scet.ac.in",
                "enrollment": "ET26BTIT816",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "srushti-tailor-event-it-quiz",
                "name": "Srushti Tailor",
                "role": "Volunteer",
                "photo": "",
                "bio": "Podium coordinator managing contestant mic handovers, buzzer hardware reliability, and answer sheets.",
                "fact": "Personally tests every single contestant buzzer ten times before showtime to guarantee zero false triggers.",
                "phone": "+91 6351923839",
                "email": "srushtitailor.it25d1@scet.ac.in",
                "enrollment": "ET26BTIT809",
                "year": "2nd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "desai-aarushi-event-it-quiz",
                "name": "Desai Aarushi",
                "role": "Volunteer",
                "photo": "",
                "bio": "Timekeeper and question runner managing strict countdown timers, audience bonus rounds, and rulebook compliance.",
                "fact": "Known as the fairest timekeeper in SCET, stopping the buzzer countdown at the exact microsecond.",
                "phone": "+91 9879533685",
                "email": "aarushidesai.it25d1@scet.ac.in",
                "enrollment": "ET26BTIT801",
                "year": "2nd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "event-cyber-quiz",
        "name": "Cyber Quiz Track",
        "color": "purple",
        "description": "Information security, crypto, OSINT, and ethical hacking trivia showdown.",
        "members": [
            {
                "id": "dhwani-bharatkumar-athaviya-event-cyber-quiz",
                "name": "Dhwani Bharatkumar Athaviya",
                "role": "Event Head",
                "photo": "",
                "bio": "Cybersecurity mastermind crafting cryptographic ciphers, network packet mysteries, and ethical hacking riddles with razor-sharp intellect.",
                "fact": "Crafts cryptographic puzzles that require real investigative forensics, leaving zero room for lucky guesses.",
                "phone": "+91 8849442439",
                "email": "dhwaniathaviya.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT073",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "priteish-ratilal-patil-event-cyber-quiz",
                "name": "Priteish Ratilal Patil",
                "role": "Event Head",
                "photo": "",
                "bio": "Lab defense architect managing terminal security, CTF flag hashes, and live vulnerability quiz rounds.",
                "fact": "Can spot someone inspecting browser source code or network traffic across a crowded computer lab.",
                "phone": "+91 9723422109",
                "email": "priteshpatil.aids25@scet.ac.in",
                "enrollment": "ET25BTAI041",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "dhruhi-sachinkumar-modh-event-cyber-quiz",
                "name": "Dhruhi Sachinkumar Modh",
                "role": "Event Head",
                "photo": "",
                "bio": "Cyber challenge director supervising multi-terminal scoring, time-stamped flag submissions, and sudden-death tie-breakers.",
                "fact": "Runs high-stakes multi-screen testing with the calm coolness of a seasoned security operations analyst.",
                "phone": "+91 7433833757",
                "email": "dhruhimodh.aids25@scet.ac.in",
                "enrollment": "ET25BTAI029",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "raajvi-ashwin-patel-event-cyber-quiz",
                "name": "Raajvi Ashwin Patel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Terminal marshal guiding participants, enforcing strict offline test rules, and maintaining absolute exam integrity.",
                "fact": "Maintains absolute discipline in the lab with a gentle smile and an unshakeable presence.",
                "phone": "+91 8758247159",
                "email": "raajvipatel.aids25@scet.ac.in",
                "enrollment": "ET25BTAI045",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "zena-vaghani-event-cyber-quiz",
                "name": "Zena Vaghani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Network monitor ensuring browser lockdowns, secure sandbox setups, and fair play across all participating teams.",
                "fact": "Keeps competitive terminals locked down tighter than an enterprise zero-trust firewall.",
                "phone": "+91 7862930499",
                "email": "zenavaghani.it24d1@scet.ac.in",
                "enrollment": "ET24BTIT068",
                "year": "3rd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "kesha-shah-event-cyber-quiz",
                "name": "Kesha Shah",
                "role": "Volunteer",
                "photo": "",
                "bio": "CTF evaluator cross-referencing contestant flag submissions, hash digests, and round completion times.",
                "fact": "Verifies encrypted flag hashes with forensic precision and catches subtle decoding errors instantly.",
                "phone": "+91 9099010228",
                "email": "keshashah.aids25@scet.ac.in",
                "enrollment": "ET25BTAI057",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "charmi-mayani-event-cyber-quiz",
                "name": "Charmi Mayani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Lab technical coordinator handling hardware readiness, display connections, and smooth team rotations between rounds.",
                "fact": "Can swap out and configure a misbehaving lab machine in less than 40 seconds flat.",
                "phone": "+91 9099280705",
                "email": "charmimayani.it24d1@scet.ac.in",
                "enrollment": "ET24BTIT033",
                "year": "3rd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "pratham-rathod-event-cyber-quiz",
                "name": "Pratham Rathod",
                "role": "Volunteer",
                "photo": "",
                "bio": "Round 1 testing coordinator verifying competitor badges, distributing challenge sheets, and overseeing answer collection.",
                "fact": "Eagle-eyed proctor who ensures no smartphones or smartwatches enter the testing perimeter.",
                "phone": "+91 9913140078",
                "email": "prathamrathod.aids25@scet.ac.in",
                "enrollment": "ET25BTAI052",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "misha-dhola-event-cyber-quiz",
                "name": "Misha Dhola",
                "role": "Volunteer",
                "photo": "",
                "bio": "Arena coordinator guiding teams to their assigned stations and managing seamless round turnarounds with calm poise.",
                "fact": "Brings clarity, order, and friendly reassurance to an otherwise intense cybersecurity battleground.",
                "phone": "+91 9925735971",
                "email": "mishadhola.aids25@scet.ac.in",
                "enrollment": "ET25BTAI027",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "event-py-it",
        "name": "PY-IT Track",
        "color": "emerald",
        "description": "Python mastery, scripting challenges, automated pipelines, and creative logic showdown.",
        "members": [
            {
                "id": "parekh-manal-event-py-it",
                "name": "Parekh Manal",
                "role": "Event Head",
                "photo": "",
                "bio": "Python virtuoso who designs creative logic sprints, regex decoding puzzles, and real-world scripting challenges that celebrate pythonic elegance.",
                "fact": "Firmly believes that any problem in the universe can be solved with the right list comprehension.",
                "phone": "+91 9925033816",
                "email": "manalparekh.aids24@scet.ac.in",
                "enrollment": "ET24BTAI036",
                "year": "3rd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "ganatra-hetavi-event-py-it",
                "name": "Ganatra Hetavi",
                "role": "Event Head",
                "photo": "",
                "bio": "Python lead curating high-speed syntax sprints, algorithmic edge cases, and automated test runners.",
                "fact": "Can write clean, PEP-8 compliant Python scripts in her sleep without a single linter warning.",
                "phone": "+91 9879457592",
                "email": "hetaviganatra.aids24@scet.ac.in",
                "enrollment": "ET24BTAI013",
                "year": "3rd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "modi-priyanshi-event-py-it",
                "name": "Modi Priyanshi",
                "role": "Event Head",
                "photo": "",
                "bio": "Code evaluation director managing automated test executions, runtime penalties, and live debugging tie-breakers.",
                "fact": "Crafts unit tests designed specifically to catch sneaky mutable default arguments and recursion limits.",
                "phone": "+91 9773291110",
                "email": "Priyanshimodi.aids24@scet.ac.in",
                "enrollment": "ET24BTAI035",
                "year": "3rd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "patel-mann-event-py-it",
                "name": "Patel Mann",
                "role": "Volunteer",
                "photo": "",
                "bio": "Lab technical coordinator setting up clean Python virtual environments, package dependencies, and terminal credentials.",
                "fact": "Always keeps pre-tested virtual environment scripts and interpreter configs ready on his flash drive.",
                "phone": "+91 7984019228",
                "email": "mannpatel.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT122",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "rajani-yug-event-py-it",
                "name": "Rajani Yug",
                "role": "Volunteer",
                "photo": "",
                "bio": "Competitor runner helping participants navigate runtime paths, submission folders, and contest ground rules.",
                "fact": "Can spot a missing colon or an indentation mismatch from three rows of desks away.",
                "phone": "+91 7016593094",
                "email": "yugrajani.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT131",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "namra-saliya-event-py-it",
                "name": "Namra Saliya",
                "role": "Volunteer",
                "photo": "",
                "bio": "Lab coordinator managing seating allocations, question handouts, and evaluator score collections with upbeat energy.",
                "fact": "His friendly encouragement and quick support keep competing Python programmers energized throughout.",
                "phone": "+91 7984604475",
                "email": "namrasaliya.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT133",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "yashasvi-joshi-event-py-it",
                "name": "Yashasvi Joshi",
                "role": "Volunteer",
                "photo": "",
                "bio": "Evaluation assistant checking participant output formatting, timing deadlines, and test execution integrity.",
                "fact": "Ensures every participant's script runs against official test inputs with complete fairness and transparency.",
                "phone": "+91 7990294656",
                "email": "yashasvijoshi.it25d1@scet.ac.in",
                "enrollment": "ET25BTIT019",
                "year": "2nd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "happy-patel-event-py-it",
                "name": "Happy Patel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Participant coordinator welcoming contestants, managing check-ins, and announcing finalist rankings with a radiant smile.",
                "fact": "Lives up to her name by keeping everyone smiling, relaxed, and cheerful even during tough coding rounds.",
                "phone": "+91 7990080125",
                "email": "happypatel.it25d1@scet.ac.in",
                "enrollment": "ET25BTIT041",
                "year": "2nd Year",
                "div": "IT-1",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "krisha-vithani-event-py-it",
                "name": "Krisha Vithani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Evaluation assistant verifying syntax efficiency, clean code structures, and ingenious algorithmic shortcuts.",
                "fact": "Has an eye for spotting clever mathematical shortcuts that bypass complex nested loops.",
                "phone": "+91 9924311629",
                "email": "krishabenvithani.aids@scet.ac.in",
                "enrollment": "ET25BTAI071",
                "year": "2nd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "event-bug-buzz",
        "name": "Bug Buzz Track",
        "color": "red",
        "description": "Live syntax dissection, logic patch battles, and reverse debugging speedruns.",
        "members": [
            {
                "id": "nandani-thakkar-event-bug-buzz",
                "name": "Nandani Thakkar",
                "role": "Event Head",
                "photo": "",
                "bio": "The diabolical puzzle architect behind Bug Buzz. Nandani embeds sneaky pointer bugs, memory leaks, and subtle off-by-one errors that test the mettle of top coders.",
                "fact": "Writes logic traps so delightfully devious that even experienced senior programmers stop to scratch their heads.",
                "phone": "+91 7863829506",
                "email": "nandanithakkar.it24d2@sct.ac.in",
                "enrollment": "ET24BTIT136",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "mahek-parmar-event-bug-buzz",
                "name": "Mahek Parmar",
                "role": "Event Head",
                "photo": "",
                "bio": "Debugging maestro managing competitive evaluation, compiler warning decoders, and penalty deductions with sharp insight.",
                "fact": "Can trace an obscure stack overflow exception by eye in under ten seconds.",
                "phone": "+91 8511896079",
                "email": "mahekparmar.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT106",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "sapnil-savani-event-bug-buzz",
                "name": "Sapnil Savani",
                "role": "Event Head",
                "photo": "",
                "bio": "Technical lead managing multi-language compiler sandboxes, code injection safety, and final live debugging duels.",
                "fact": "Designs real-world debugging scenarios that mirror high-pressure software engineering fire drills.",
                "phone": "+91 8106548907",
                "email": "sapnilsavani.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT127",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "vigna-patel-event-bug-buzz",
                "name": "Vigna Patel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Lab troubleshooter assisting contestants with terminal configurations, compiler flags, and editor settings.",
                "fact": "The fastest terminal troubleshooter in the room, resolving syntax setup issues in the blink of an eye.",
                "phone": "+91 9898124047",
                "email": "vignapatel.it24d2@scet.ac.in",
                "enrollment": "ET24BTIT119",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "yashvi-bhatt-event-bug-buzz",
                "name": "Yashvi Bhatt",
                "role": "Volunteer",
                "photo": "",
                "bio": "Timer and scorekeeper tracking bug discovery speed, patch submission order, and penalty point calculations.",
                "fact": "Master of stopwatch timing who records submission seconds with forensic precision.",
                "phone": "+91 9712701131",
                "email": "yashvibhattit.24d2@scet.ac.in",
                "enrollment": "ET24BTIT075",
                "year": "3rd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "mann-patel-event-bug-buzz",
                "name": "Mann Patel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Evaluation runner verifying that patched code passes all hidden test cases before awarding full points.",
                "fact": "Always has a suite of boundary edge cases ready to test whether a bug fix is truly robust.",
                "phone": "+91 7984019228",
                "email": "mannpatel.it24d2@scet.ac.in",
                "enrollment": "ET25BTIT122",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "yug-rajani-event-bug-buzz",
                "name": "Yug Rajani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Arena assistant logging compiler errors, contestant score tallies, and round advancement rosters.",
                "fact": "Has an instinctive radar for unclosed brackets and sneaky typo bugs that slip past tired eyes.",
                "phone": "+91 7016593094",
                "email": "yugrajaniit.24d2@scet.ac.in",
                "enrollment": "Et25btit131",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "aalap-khunt-event-bug-buzz",
                "name": "Aalap Khunt",
                "role": "Volunteer",
                "photo": "",
                "bio": "Hardware and lab assistant ensuring all competitor machines operate with zero lag, fresh keyboards, and clear screens.",
                "fact": "Ensures every coder has the smoothest possible computing experience without a single hardware hiccup.",
                "phone": "+91 7984151523",
                "email": "aalapkhunt.it24d2@scet.ac.in",
                "enrollment": "ET25BTIT094",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "rudra-godhani-event-bug-buzz",
                "name": "Rudra Godhani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Arena observer monitoring fair play, test output compliance, and live round transitions.",
                "fact": "Catches sneaky browser searches or unauthorized shortcuts with friendly, watchful vigilance.",
                "phone": "+91 9512607383",
                "email": "rudragodhani.it24d2@scet.ac.in",
                "enrollment": "ET25BTIT081",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "aryan-prajapati-event-bug-buzz",
                "name": "Aryan Prajapati",
                "role": "Volunteer",
                "photo": "",
                "bio": "Desk coordinator managing room rotations, participant entry passes, and finalist stage handovers.",
                "fact": "Keeps the entire multi-batch debugging competition running on schedule with clockwork precision.",
                "phone": "+91 8799414778",
                "email": "aryanprajapati.it24d2@scet.ac.in",
                "enrollment": "ET25BTIT130",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "pranay-gopani-event-bug-buzz",
                "name": "Pranay Gopani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Score auditor logging judge evaluation cards, contestant time scores, and official qualifier boards.",
                "fact": "Ensures every participant gets a fair, transparent, and completely objective review of their code.",
                "phone": "+91 9106251693",
                "email": "pranaygopani.it24d2@scet.ac.in",
                "enrollment": "ET25BTIT083",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "rudra-chovatiya-event-bug-buzz",
                "name": "Rudra Chovatiya",
                "role": "Volunteer",
                "photo": "",
                "bio": "Arena runner capturing photo finishes when two teams sprint to the evaluation desk with their final patches.",
                "fact": "Always on hand right at the judging desk to record the electric moment a bug is successfully conquered.",
                "phone": "+91 7990256887",
                "email": "rudrachovatiya.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT075",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "namra-saliya-event-bug-buzz",
                "name": "Namra Saliya",
                "role": "Volunteer",
                "photo": "",
                "bio": "Support volunteer managing contestant queries, room directions, and prize announcements with boundless cheer.",
                "fact": "Rapid helper who keeps the entire event moving with infectious positivity and great teamwork.",
                "phone": "+91 7984604475",
                "email": "namrasaliya.it25d2@scet.ac.in",
                "enrollment": "ET25BTIT133",
                "year": "2nd Year",
                "div": "IT-2",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "event-logo-hunt",
        "name": "Logo Hunt Track",
        "color": "yellow",
        "description": "Visual identity discovery, tech brand forensics, and rapid deduction challenge.",
        "members": [
            {
                "id": "dixa-nileshbhai-babriya-event-logo-hunt",
                "name": "Dixa Nileshbhai Babriya",
                "role": "Event Head",
                "photo": "",
                "bio": "The mastermind behind Logo Hunt. Dixa turns the campus into an exhilarating detective playground of visual forensics, clue ciphers, and brand deduction.",
                "fact": "Can recognize a global technology brand from a single 3-pixel cropped corner of its emblem.",
                "phone": "+91 9016951932",
                "email": "",
                "enrollment": "ET24BTAI002",
                "year": "3rd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "jemi-ashwinbhai-jasoliya-event-logo-hunt",
                "name": "Jemi Ashwinbhai Jasoliya",
                "role": "Event Head",
                "photo": "",
                "bio": "Creative puzzle designer crafting encrypted visual riddles, distorted logo challenges, and campus checkpoint trails.",
                "fact": "Designs multi-layer brand logo puzzles that challenge visual memory and lateral thinking.",
                "phone": "+91 9510474023",
                "email": "",
                "enrollment": "ET24BTAI020",
                "year": "3rd Year",
                "div": "AIDS",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "diyora-yana-niteshbhai-event-logo-hunt",
                "name": "Diyora Yana Niteshbhai",
                "role": "Volunteer",
                "photo": "",
                "bio": "Checkpoint coordinator managing clue envelope distributions, team verification stamps, and timing sheets.",
                "fact": "Knows every hidden architectural nook and secret shortcut across the SCET campus.",
                "phone": "+91 9664990759",
                "email": "",
                "enrollment": "ET25BTIT079",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "mahek-sasani-dineshbhai-event-logo-hunt",
                "name": "Mahek Sasani Dineshbhai",
                "role": "Volunteer",
                "photo": "",
                "bio": "Station marshal keeping clue verification desks orderly, fun, and fast-paced during intense team rushes.",
                "fact": "Keeps her cool while 20 breathless teams sprint to her checkpoint shouting brand guesses.",
                "phone": "+91 9274487625",
                "email": "",
                "enrollment": "ET25BTIT135",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "nariya-zarna-ketankumar-event-logo-hunt",
                "name": "Nariya Zarna Ketankumar",
                "role": "Volunteer",
                "photo": "",
                "bio": "Checkpoint judge verifying team deduction logs, stamp books, and clue riddle solutions with a bright smile.",
                "fact": "Spots incorrect brand guesses in half a second while keeping contestants motivated to keep hunting.",
                "phone": "+91 8200993144",
                "email": "",
                "enrollment": "ET25BTIT107",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "hasti-moradia-event-logo-hunt",
                "name": "Hasti Moradia",
                "role": "Volunteer",
                "photo": "",
                "bio": "Starting line director and route monitor maintaining fair play and explosive team energy as the hunt begins.",
                "fact": "Delivers pre-hunt safety and rule briefings with the dramatic flair of a treasure hunt captain.",
                "phone": "+91 9909334374",
                "email": "",
                "enrollment": "ET25BTIT086",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "rudra-godhani-event-logo-hunt",
                "name": "Rudra Godhani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Campus patrol volunteer ensuring teams stay within designated boundaries and solve puzzles with honest wits.",
                "fact": "Once politely caught three teams trying to take an off-limits corridor shortcut and turned them back with a laugh.",
                "phone": "+91 9512607383",
                "email": "",
                "enrollment": "ET25BTIT081",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "chovatiya-rudra-shaileshbhai-event-logo-hunt",
                "name": "Chovatiya Rudra Shaileshbhai",
                "role": "Volunteer",
                "photo": "",
                "bio": "Finish line coordinator clocking in returning teams, recording final times, and tallying clue point cards.",
                "fact": "His high-energy countdown at the starting whistle sends teams sprinting with pure adrenaline.",
                "phone": "+91 7990256887",
                "email": "",
                "enrollment": "ET25BTIT075",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    },
    {
        "id": "event-aws-builder",
        "name": "AWS Builder Challenge",
        "color": "blue",
        "description": "Cloud architecture sprints, serverless pipelines, and AWS ecosystem challenges.",
        "members": [
            {
                "id": "jariwala-ubada-tariq-event-aws-builder",
                "name": "Jariwala Ubada Tariq",
                "role": "Head",
                "photo": "",
                "bio": "Cloud visionary and architect of the AWS Builder Challenge. Ubada demystifies serverless computing, resilient VPCs, and cloud architecture for aspiring student builders.",
                "fact": "Can diagram an entire multi-region, fault-tolerant AWS cloud infrastructure on a whiteboard in 5 minutes flat.",
                "phone": "+91 9825127728",
                "email": "",
                "enrollment": "ET24BTIT086",
                "year": "3rd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "jay-naynesh-shah-event-aws-builder",
                "name": "Jay Naynesh Shah",
                "role": "Head",
                "photo": "",
                "bio": "Serverless specialist designing event-driven Lambda challenges, IAM permission puzzles, and S3 event triggers.",
                "fact": "Deploys serverless microservices and containerized workflows before his morning coffee has finished brewing.",
                "phone": "+91 9998220491",
                "email": "",
                "enrollment": "ET25BTIT017",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "felicson-savio-event-aws-builder",
                "name": "Felicson Savio",
                "role": "Head",
                "photo": "",
                "bio": "Cloud infrastructure lead supervising sandbox environments, resource security policies, and live judging criteria.",
                "fact": "Can troubleshoot VPC peering, subnet routes, and security group conflicts in minutes.",
                "phone": "+91 9104358371",
                "email": "",
                "enrollment": "ET24BTIT137",
                "year": "3rd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "jatin-karnani-event-aws-builder",
                "name": "Jatin Karnani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Lab operations coordinator managing temporary IAM credentials, cloud console access, and participant sandbox setups.",
                "fact": "Keeps cloud event operations flowing smoothly with zero infrastructure downtime.",
                "phone": "+91 7490007646",
                "email": "",
                "enrollment": "ET25BTIT093",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "krishn-noticewala-event-aws-builder",
                "name": "Krishn Noticewala",
                "role": "Volunteer",
                "photo": "",
                "bio": "Terminal assistant helping attendees navigate AWS management consoles, CloudShell sessions, and resource tags.",
                "fact": "Maintains calm, focused attention to detail across multi-terminal cloud builds.",
                "phone": "+91 9510846618",
                "email": "",
                "enrollment": "ET25BTIT109",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "prisha-sudani-event-aws-builder",
                "name": "Prisha Sudani",
                "role": "Volunteer",
                "photo": "",
                "bio": "Participant guide walking student builders through setup rubrics, resource limits, and submission criteria with warmth.",
                "fact": "Ensures every builder gets a smooth, uninterrupted cloud sandbox to build their architectural dreams.",
                "phone": "+91 7990942633",
                "email": "",
                "enrollment": "ET25BTIT062",
                "year": "2nd Year",
                "div": "IT",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "mahek-achhara-event-aws-builder",
                "name": "Mahek Achhara",
                "role": "Volunteer",
                "photo": "",
                "bio": "Cloud challenge runner assisting with rule briefings, judge scoring sheets, and participant console questions.",
                "fact": "Always on hand with quick, friendly answers to configuration and deployment queries.",
                "phone": "+91 7227970696",
                "email": "",
                "enrollment": "ET25BTIT002",
                "year": "",
                "div": "",
                "linkedin": "",
                "instagram": "",
                "github": ""
            },
            {
                "id": "megh-patel-event-aws-builder",
                "name": "Megh Patel",
                "role": "Volunteer",
                "photo": "",
                "bio": "Cloud operations assistant verifying resource deployments, architecture health, and tear-down checklists.",
                "fact": "Reliable team player who keeps technical arenas running at peak efficiency and zero lag.",
                "phone": "",
                "email": "",
                "enrollment": "",
                "year": "",
                "div": "",
                "linkedin": "",
                "instagram": "",
                "github": ""
            }
        ]
    }
],
  },
};

const CONFIG_CACHE_KEY = "__converse_site_config";

function getCachedConfig(): SiteConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONFIG_CACHE_KEY) || sessionStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      landing: { ...DEFAULT_SITE_CONFIG.landing, ...(parsed.landing || {}) },
      dashboard: { ...DEFAULT_SITE_CONFIG.dashboard, ...(parsed.dashboard || {}) },
      events: { ...DEFAULT_SITE_CONFIG.events, ...(parsed.events || {}) },
      profile: { ...DEFAULT_SITE_CONFIG.profile, ...(parsed.profile || {}) },
      about: { ...DEFAULT_SITE_CONFIG.about, ...(parsed.about || {}) },
      onboarding: {
        ...DEFAULT_SITE_CONFIG.onboarding,
        ...(parsed.onboarding || {}),
        fields: {
          ...DEFAULT_SITE_CONFIG.onboarding.fields,
          ...(parsed.onboarding?.fields || {}),
        },
      },
      footer: {
        ...DEFAULT_SITE_CONFIG.footer,
        ...(parsed.footer || {}),
      },
      reminderSettings: {
        ...DEFAULT_SITE_CONFIG.reminderSettings,
        ...(parsed.reminderSettings || {}),
      },
      team: {
        ...DEFAULT_SITE_CONFIG.team!,
        ...(parsed.team || {}),
        categories: (Array.isArray(parsed.team?.categories) && parsed.team.categories.length >= 10 && parsed.team.categories.some((c: any) => c.id === "marketing-registration"))
          ? parsed.team.categories
          : DEFAULT_SITE_CONFIG.team!.categories,
      },
    } as SiteConfig;
  } catch {
    return null;
  }
}

function setCachedConfig(cfg: SiteConfig) {
  if (typeof window === "undefined") return;
  try {
    const str = JSON.stringify(cfg);
    localStorage.setItem(CONFIG_CACHE_KEY, str);
    sessionStorage.setItem(CONFIG_CACHE_KEY, str);
  } catch { /* ignore */ }
}

/**
 * Canonical hierarchy ranking for Faculty Coordinators:
 * 1. Vivek sir (Dr. Vivek Champaneria)
 * 2. Vibha mam (Dr. Vibha Patel)
 * 3. Bhumika mam (Prof. Bhumika Shah)
 */
export function getFacultyRank(name: string): number {
  const n = (name || "").toLowerCase();
  if (n.includes("mita")) return 0; // HOD Dr. Mita Parikh is always top
  if (n.includes("vivek")) return 1;
  if (n.includes("vibha")) return 2;
  if (n.includes("bhumika")) return 3;
  return 99;
}

export function sortFacultyNames(names: string[]): string[] {
  if (!Array.isArray(names)) return [];
  return [...names].sort((a, b) => {
    const rankA = getFacultyRank(a);
    const rankB = getFacultyRank(b);
    if (rankA !== 99 && rankB !== 99) {
      return rankA - rankB;
    }
    return 0;
  });
}

/**
 * Member priority score for ordering within a section.
 * Lower score = appears earlier (closer to top of section).
 * - Leadership: HOD (1), Dr. Vivek (2), Dr. Vibha (3), Prof. Bhumika (4), other faculty (5).
 * - Student Heads: Student Head / Overall Lead (1), Member (10).
 * - Committees: Committee Head / Lead / Chief (1), Co-Head (3), Committee Member (10).
 * - Event Tracks: Event Coordinator / Lead (1), Co-Coordinator (3), Volunteer (10).
 */
export function getMemberPriority(member: TeamMember, categoryId = "", categoryName = ""): number {
  if (!member) return 999;
  const role = (member.role || "").toLowerCase().trim();
  const name = (member.name || "").toLowerCase().trim();
  const catId = (categoryId || "").toLowerCase().trim();
  const catName = (categoryName || "").toLowerCase().trim();

  // 1. Leadership / Faculty
  if (
    catId === "hod-faculty" ||
    catId === "leadership-advisory" ||
    catName.includes("faculty") ||
    catName.includes("leadership") ||
    catName.includes("principal")
  ) {
    if (role.includes("hod") || role.includes("head of department") || name.includes("mita")) return 1;
    if (name.includes("vivek")) return 2;
    if (name.includes("vibha")) return 3;
    if (name.includes("bhumika")) return 4;
    if (role.includes("faculty") || role.includes("mentor") || role.includes("coordinator")) return 5;
    return 10;
  }

  // 2. Student Leads
  if (catId === "student-heads" || catName.includes("student head") || catName.includes("overall lead")) {
    if (role.includes("student head") || role.includes("head") || role.includes("lead")) return 1;
    return 10;
  }

  // 3. Event Track sections
  const isEventTrack =
    catId.startsWith("event-") ||
    catName.includes("event") ||
    catName.includes("codathon") ||
    catName.includes("arena") ||
    catName.includes("crafter") ||
    catName.includes("hunt") ||
    catName.includes("quiz") ||
    catName.includes("robot") ||
    catName.includes("clash") ||
    catName.includes("escape") ||
    catName.includes("track") ||
    catName.includes("challenge") ||
    catName.includes("buzz");

  if (isEventTrack) {
    // Faculty / Mentors are always on the very top of the track
    if (role.includes("faculty") || role.includes("mentor") || role.includes("advisor") || role.includes("prof") || role.includes("dr.")) return 0;
    // Coordinators are always on top of students
    if (role.includes("coordinator") && !role.includes("co-coordinator") && !role.includes("sub-coordinator")) return 1;
    if (role.includes("head") || role.includes("lead")) return 2;
    if (role.includes("co-coordinator") || role.includes("sub-coordinator") || role.includes("assistant")) return 3;
    if (role.includes("volunteer")) return 10;
    return 5;
  }

  // 4. Committee sections (Web & Tech, Design, Marketing, Finance, Logistics, PR, etc.)
  // Faculty / Mentors on top, then Heads
  if (role.includes("faculty") || role.includes("advisor") || role.includes("mentor") || role.includes("prof") || role.includes("dr.")) return 0;
  if (role.includes("head") && !role.includes("co-head") && !role.includes("sub-head")) return 1;
  if (role.includes("lead") || role.includes("chief") || role.includes("director")) return 2;
  if (role.includes("co-head") || role.includes("sub-head") || role.includes("assistant")) return 3;
  if (role.includes("member")) return 10;
  return 5;
}

export function sortCategoryMembers(members: TeamMember[], categoryId = "", categoryName = ""): TeamMember[] {
  if (!Array.isArray(members) || members.length <= 1) return members || [];
  return [...members].sort((a, b) => {
    const pA = getMemberPriority(a, categoryId, categoryName);
    const pB = getMemberPriority(b, categoryId, categoryName);
    if (pA !== pB) return pA - pB;
    return 0; // Maintain original stable order among peers with equal rank
  });
}

export function sortFacultyMembers(members: TeamMember[]): TeamMember[] {
  return sortCategoryMembers(members, "hod-faculty", "Faculty");
}

/**
 * Real-time listener for editable site content from Firestore.
 * Instantly serves cached data while the listener syncs.
 */
export function useSiteConfig() {
  const cached = getCachedConfig();
  const [config, setConfig] = useState<SiteConfig>(cached ?? DEFAULT_SITE_CONFIG);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "siteConfig", "siteContent"),
      (docSnap) => {
        if (docSnap.exists()) {
          // Merge with default to ensure no missing nested fields
          const data = docSnap.data() as Partial<SiteConfig> & { sponsorsEnabled?: boolean };
          
          let isSponsorsEnabled = true;
          if (typeof data.landing?.sponsorsEnabled === "boolean") {
            isSponsorsEnabled = data.landing.sponsorsEnabled;
          } else if (typeof data.sponsorsEnabled === "boolean") {
            isSponsorsEnabled = data.sponsorsEnabled;
          }

          const rawLanding = { 
            ...DEFAULT_SITE_CONFIG.landing, 
            ...data.landing,
            sponsorsEnabled: isSponsorsEnabled,
          };

          // Backward compat: old sponsors were string[], migrate to object[]
          const COLORS = ["#C91A09", "#E8B800", "#0055BF", "#1b1b1b"];
          if (Array.isArray(rawLanding.sponsors)) {
            rawLanding.sponsors = rawLanding.sponsors.map((sp: any, i: number) => {
              if (typeof sp === "string") {
                return { name: sp, url: "", color: COLORS[i % COLORS.length]!, desc: "" };
              }
              // Ensure desc field exists for old objects without it
              return { desc: "", ...sp };
            });
          }

          let isExploreEnabled = true;
          if (typeof data.dashboard?.exploreEnabled === "boolean") {
            isExploreEnabled = data.dashboard.exploreEnabled;
          } else if (typeof (data as any).exploreEnabled === "boolean") {
            isExploreEnabled = (data as any).exploreEnabled;
          }

          const rawFooterFaculty = Array.isArray(data.footer?.facultyCoordinators)
            ? data.footer.facultyCoordinators
            : DEFAULT_SITE_CONFIG.footer.facultyCoordinators;

          const hasUpgradedTeam = Array.isArray(data.team?.categories) &&
            data.team.categories.length >= 10 &&
            data.team.categories.some((c: any) => c.id === "marketing-registration" || c.id === "event-codathon");

          const rawTeamCategories = (hasUpgradedTeam && data.team?.categories)
            ? data.team.categories
            : DEFAULT_SITE_CONFIG.team!.categories;

          const merged: SiteConfig = {
            landing: rawLanding,
            dashboard: { 
              ...DEFAULT_SITE_CONFIG.dashboard, 
              ...(data.dashboard || {}),
              exploreEnabled: isExploreEnabled,
            },
            events: { ...DEFAULT_SITE_CONFIG.events, ...data.events },
            profile: { ...DEFAULT_SITE_CONFIG.profile, ...data.profile },
            about: { ...DEFAULT_SITE_CONFIG.about, ...data.about },
            onboarding: { 
              ...DEFAULT_SITE_CONFIG.onboarding, 
              ...data.onboarding,
              collegeOptions: Array.isArray(data.onboarding?.collegeOptions) && data.onboarding.collegeOptions.length > 0
                ? data.onboarding.collegeOptions
                : DEFAULT_SITE_CONFIG.onboarding.collegeOptions,
              branchOptions: Array.isArray(data.onboarding?.branchOptions) && data.onboarding.branchOptions.length > 0
                ? data.onboarding.branchOptions
                : DEFAULT_SITE_CONFIG.onboarding.branchOptions,
              fields: {
                ...DEFAULT_SITE_CONFIG.onboarding.fields,
                ...(data.onboarding?.fields || {})
              }
            },
            footer: {
              ...DEFAULT_SITE_CONFIG.footer,
              ...(data.footer || {}),
              facultyCoordinators: sortFacultyNames(rawFooterFaculty),
              studentHeads: Array.isArray(data.footer?.studentHeads)
                ? data.footer.studentHeads
                : DEFAULT_SITE_CONFIG.footer.studentHeads,
            },
            reminderSettings: {
              ...DEFAULT_SITE_CONFIG.reminderSettings,
              ...(data.reminderSettings || {}),
            },
            team: {
              ...DEFAULT_SITE_CONFIG.team!,
              ...(data.team || {}),
              ctaEnabled: data.team?.ctaEnabled !== false,
              categories: rawTeamCategories.map((cat) => ({
                ...cat,
                members: sortCategoryMembers(cat.members || [], cat.id, cat.name),
              })),
            },
          };
          setConfig(merged);
          setCachedConfig(merged);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching site config:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { config, loading };
}

export async function updateSiteConfig(newConfig: SiteConfig) {
  setCachedConfig(newConfig);

  await setDoc(
    doc(db, "siteConfig", "siteContent"),
    { 
      ...newConfig, 
      sponsorsEnabled: newConfig.landing?.sponsorsEnabled !== false,
      exploreEnabled: newConfig.dashboard?.exploreEnabled !== false,
      updatedAt: serverTimestamp() 
    },
    { merge: true }
  );
}

export async function setSponsorsVisibility(enabled: boolean) {
  try {
    const current = getCachedConfig() || DEFAULT_SITE_CONFIG;
    const updated: SiteConfig = {
      ...current,
      landing: {
        ...current.landing,
        sponsorsEnabled: enabled,
      },
    };
    (updated as any).sponsorsEnabled = enabled;
    setCachedConfig(updated);
  } catch { /* ignore */ }

  try {
    await updateDoc(doc(db, "siteConfig", "siteContent"), {
      "landing.sponsorsEnabled": enabled,
      sponsorsEnabled: enabled,
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    await setDoc(
      doc(db, "siteConfig", "siteContent"),
      {
        landing: {
          sponsorsEnabled: enabled,
        },
        sponsorsEnabled: enabled,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export async function setTeamCtaVisibility(enabled: boolean) {
  let updatedTeam: any = null;
  try {
    const current = getCachedConfig() || DEFAULT_SITE_CONFIG;
    updatedTeam = {
      ...(current.team || DEFAULT_SITE_CONFIG.team!),
      ctaEnabled: enabled,
    };
    const updated: SiteConfig = {
      ...current,
      team: updatedTeam,
    };
    setCachedConfig(updated);
  } catch { /* ignore */ }

  try {
    await updateDoc(doc(db, "siteConfig", "siteContent"), {
      "team.ctaEnabled": enabled,
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    await setDoc(
      doc(db, "siteConfig", "siteContent"),
      {
        ...(updatedTeam ? { team: updatedTeam } : { "team.ctaEnabled": enabled }),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export async function setDashboardExploreVisibility(enabled: boolean) {
  let updatedDashboard: any = null;
  try {
    const current = getCachedConfig() || DEFAULT_SITE_CONFIG;
    updatedDashboard = {
      ...current.dashboard,
      exploreEnabled: enabled,
    };
    const updated: SiteConfig = {
      ...current,
      dashboard: updatedDashboard,
    };
    (updated as any).exploreEnabled = enabled;
    setCachedConfig(updated);
  } catch { /* ignore */ }

  try {
    await updateDoc(doc(db, "siteConfig", "siteContent"), {
      "dashboard.exploreEnabled": enabled,
      exploreEnabled: enabled,
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    await setDoc(
      doc(db, "siteConfig", "siteContent"),
      {
        ...(updatedDashboard ? { dashboard: updatedDashboard } : { "dashboard.exploreEnabled": enabled }),
        exploreEnabled: enabled,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

