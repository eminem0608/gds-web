const API_BASE = "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "include",
    ...options
  });

  if (!response.ok) {
    throw new Error(`API ${path} failed with ${response.status}`);
  }

  return response.json();
}

export const brewApi = {
  getDashboard() {
    return request("/api/brew/dashboard");
  },
  getTanks() {
    return request("/api/brew/tanks");
  },
  getMaterials() {
    return request("/api/brew/materials");
  },
  getTasks() {
    return request("/api/brew/tasks");
  }
};
