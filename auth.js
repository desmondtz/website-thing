(() => {
  const students = {
    "12-3456": { name: "Stephen", courseSection: "BSCS-1D", password: "1234" },
    "26-1234": { name: "Zhieck", courseSection: "BSIS-1D", password: "1234" }
  };
  const sessionKey = "classhub-student";

  function readStudent(idCode) {
    const student = students[idCode];
    if (!student) return null;
    return {
      idCode,
      name: student.name,
      courseSection: student.courseSection
    };
  }

  window.ClassHubAuth = {
    login(idCode, password) {
      const normalizedId = idCode.trim();
      const student = students[normalizedId];
      if (!student || student.password !== password) return false;
      const profile = readStudent(normalizedId);
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(profile));
        return true;
      } catch {
        window.location.assign(`qwe.html#student=${encodeURIComponent(profile.idCode)}`);
        return "redirecting";
      }
    },

    currentStudent() {
      try {
        const stored = sessionStorage.getItem(sessionKey);
        if (stored) {
          const profile = JSON.parse(stored);
          return readStudent(profile.idCode);
        }
      } catch {
        // Local files can disable session storage; use the non-secret ID in the URL fragment.
      }
      const match = window.location.hash.match(/(?:^|[#&])student=([^&]+)/);
      return match ? readStudent(decodeURIComponent(match[1])) : null;
    },

    logout() {
      try {
        sessionStorage.removeItem(sessionKey);
      } catch {
        // Navigation still returns the student to the sign-in page without storage.
      }
    }
  };
})();
