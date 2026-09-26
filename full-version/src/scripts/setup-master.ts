/**
 * One-time script to set the master admin role for an existing Google-authenticated user.
 * Since we can't sign in with Google from a CLI script, this approach uses the Firebase
 * REST API to sign in with email/password, then updates the Firestore doc.
 * 
 * Actually - we'll just do it from the browser. Let me create a quick admin setup page.
 */

// This can't work from CLI due to Firestore rules requiring authentication.
// Instead, we'll add a one-time setup route.
console.log("⚠️  Firestore rules block unauthenticated writes.");
console.log("");
console.log("To set your account as master admin, follow these steps:");
console.log("1. Go to Firebase Console → https://console.firebase.google.com/project/converse2k26/firestore");
console.log("2. Navigate to the 'users' collection");
console.log("3. Find the document with email 'malharbalar144@gmail.com'");
console.log("4. Change the 'role' field to 'master'");
console.log("");
console.log("OR use the 'Sign in with Google (Admin)' button on the admin page");
console.log("after manually setting the role in Firestore.");
