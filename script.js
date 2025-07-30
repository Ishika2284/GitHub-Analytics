class GitHubDashboard {
  constructor() {
    this.baseURL = "https://api.github.com"
    this.currentUser = null
    this.repositories = []
    this.filteredRepositories = []
    this.activities = []
    this.filteredActivities = []
    this.currentPage = 1
    this.itemsPerPage = 10
    this.searchHistory = JSON.parse(localStorage.getItem("github-search-history") || "[]")
    this.savedProfiles = JSON.parse(localStorage.getItem("github-saved-profiles") || "[]")
    this.currentSort = "stars"
    this.currentActivityFilter = "all"
    this.currentChartView = "pie"
    this.currentTimePeriod = "30d"
    this.currentView = "dashboard"
    this.views = {
      dashboard: "dashboardContent",
      profiles: "profilesView",
      repositories: "repositoriesView",
      analytics: "analyticsView",
    }
    this.notifications = []
    this.shortcuts = {}
    this.userPreferences = JSON.parse(localStorage.getItem("github-preferences") || "{}")
    this.compareProfiles = []
    this.bookmarkedProfiles = JSON.parse(localStorage.getItem("github-bookmarks") || "[]")
    this.aiInsights = {}
    this.performanceMetrics = {}
    this.collaborationNetwork = {}
    this.trendingRepos = []
    this.developerScore = 0
    this.achievements = []
    this.exportFormats = ["json", "csv", "pdf", "xlsx"]
    this.languages = ["en", "es", "fr", "de", "zh", "ja"]
    this.currentLanguage = localStorage.getItem("github-language") || "en"
    this.voiceEnabled = false
    this.offlineMode = false
    this.realTimeUpdates = false
    this.customDashboard = JSON.parse(localStorage.getItem("custom-dashboard") || "[]")
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.loadTheme()
    this.displayRecentProfiles()
    this.loadDefaultProfile()
  }

  setupEventListeners() {
    // Search functionality
    document.getElementById("searchBtn").addEventListener("click", () => this.analyzeProfile())
    document.getElementById("usernameInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.analyzeProfile()
    })
    document.getElementById("usernameInput").addEventListener("input", (e) => this.handleSearchInput(e))

    // Quick profile buttons
    document.querySelectorAll(".quick-profile").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.getElementById("usernameInput").value = e.target.dataset.username
        this.analyzeProfile()
      })
    })

    // Theme toggle
    document.getElementById("themeToggle").addEventListener("click", () => this.toggleTheme())

    // Retry button
    document.getElementById("retryBtn").addEventListener("click", () => this.analyzeProfile())

    // Table controls
    document.getElementById("repoSearch").addEventListener("input", (e) => this.filterRepositories(e.target.value))
    document.getElementById("repoSort").addEventListener("change", (e) => this.sortRepositories(e.target.value))

    // Activity filters
    document.querySelectorAll(".activity-filter").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.filterActivity(e.target.dataset.type)
        this.updateActiveFilter(e.target, ".activity-filter")
      })
    })

    // Chart controls
    document.querySelectorAll(".chart-control").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.toggleChartView(e.target.dataset.view)
        this.updateActiveFilter(e.target, ".chart-control")
      })
    })

    // Time filters
    document.querySelectorAll(".time-filter").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.filterByTime(e.target.dataset.period)
        this.updateActiveFilter(e.target, ".time-filter")
      })
    })

    // Pagination
    document.getElementById("prevPage").addEventListener("click", () => this.changePage(-1))
    document.getElementById("nextPage").addEventListener("click", () => this.changePage(1))

    // Profile actions
    document.getElementById("exportBtn").addEventListener("click", () => this.exportData())
    document.getElementById("shareBtn").addEventListener("click", () => this.shareProfile())

    // Sidebar actions
    document.getElementById("analyzeBtn").addEventListener("click", () => {
      const input = document.getElementById("usernameInput")
      input.focus()
      input.scrollIntoView({ behavior: "smooth" })
    })

    // Add event listeners for Export Data and Share Report buttons
    document.querySelectorAll(".action-card").forEach((card, index) => {
      card.addEventListener("click", () => {
        const icon = card.querySelector("i").className
        const text = card.querySelector("span").textContent

        if (icon.includes("fa-search")) {
          // Analyze Profile - already handled above
          const input = document.getElementById("usernameInput")
          input.focus()
          input.scrollIntoView({ behavior: "smooth" })
          this.showToast("Focus moved to search input", "info")
        } else if (icon.includes("fa-download")) {
          // Export Data
          this.handleQuickExport()
        } else if (icon.includes("fa-share")) {
          // Share Report
          this.handleQuickShare()
        }
      })
    })

    // Global search
    document.getElementById("globalSearch").addEventListener("input", (e) => this.handleGlobalSearch(e.target.value))

    // Navigation
    document.querySelectorAll(".nav-item").forEach((navItem) => {
      navItem.addEventListener("click", (e) => {
        e.preventDefault()
        const view = e.currentTarget.getAttribute("href").substring(1) || "dashboard"
        this.switchView(view)
        this.updateActiveNav(e.currentTarget)
      })
    })
  }

  async loadDefaultProfile() {
    document.getElementById("usernameInput").value = "octocat"
    await this.analyzeProfile()
  }

  async analyzeProfile() {
    const username = document.getElementById("usernameInput").value.trim()

    if (!username) {
      this.showToast("Please enter a GitHub username", "warning")
      return
    }

    this.showLoading()
    this.hideError()
    this.hideDashboard()

    try {
      this.updateLoadingProgress("Fetching user data...", 25)
      const userData = await this.fetchUserData(username)

      this.updateLoadingProgress("Loading repositories...", 50)
      const reposData = await this.fetchUserRepos(username)

      this.updateLoadingProgress("Analyzing activity...", 75)
      const eventsData = await this.fetchUserEvents(username)

      this.updateLoadingProgress("Generating insights...", 100)

      this.currentUser = userData
      this.repositories = reposData
      this.filteredRepositories = [...reposData]
      this.activities = eventsData
      this.filteredActivities = [...eventsData]

      // Add to search history
      this.addToSearchHistory(userData)

      setTimeout(() => {
        this.hideLoading()
        this.displayDashboard(userData, reposData, eventsData)
        this.showDashboard()
        this.showToast("Profile analyzed successfully!", "success")
      }, 500)
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
      this.showToast("Failed to analyze profile", "error")
    }
  }

  async fetchUserData(username) {
    const response = await fetch(`${this.baseURL}/users/${username}`)
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("User not found. Please check the username.")
      }
      if (response.status === 403) {
        throw new Error("API rate limit exceeded. Please try again later.")
      }
      throw new Error("Failed to fetch user data. Please try again.")
    }
    return await response.json()
  }

  async fetchUserRepos(username) {
    const response = await fetch(`${this.baseURL}/users/${username}/repos?sort=stars&per_page=100`)
    if (!response.ok) {
      throw new Error("Failed to fetch repositories")
    }
    return await response.json()
  }

  async fetchUserEvents(username) {
    try {
      const response = await fetch(`${this.baseURL}/users/${username}/events/public?per_page=30`)
      if (!response.ok) return []
      return await response.json()
    } catch (error) {
      return []
    }
  }

  async handleSearchInput(e) {
    const query = e.target.value.trim()
    if (query.length > 2) {
      await this.showSearchSuggestions(query)
    } else {
      this.hideSearchSuggestions()
    }
  }

  async showSearchSuggestions(query) {
    try {
      const response = await fetch(`${this.baseURL}/search/users?q=${query}&per_page=5`)
      if (response.ok) {
        const data = await response.json()
        this.displaySearchSuggestions(data.items)
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error)
    }
  }

  displaySearchSuggestions(users) {
    const container = document.getElementById("searchSuggestions")

    if (users.length === 0) {
      container.style.display = "none"
      return
    }

    container.innerHTML = users
      .map(
        (user) => `
        <div class="suggestion-item" data-username="${user.login}">
          <img src="${user.avatar_url}" alt="${user.login}" style="width: 24px; height: 24px; border-radius: 50%;">
          <div>
            <div style="font-weight: 600;">${user.login}</div>
            <div style="font-size: 0.8rem; color: var(--gray-500);">${user.type}</div>
          </div>
        </div>
      `,
      )
      .join("")

    // Add click handlers
    container.querySelectorAll(".suggestion-item").forEach((item) => {
      item.addEventListener("click", () => {
        document.getElementById("usernameInput").value = item.dataset.username
        this.hideSearchSuggestions()
        this.analyzeProfile()
      })
    })

    container.style.display = "block"
  }

  hideSearchSuggestions() {
    document.getElementById("searchSuggestions").style.display = "none"
  }

  displayDashboard(userData, reposData, eventsData) {
    this.displayUserProfile(userData)
    this.displayMetrics(userData, reposData)
    this.displayLanguageChart(reposData)
    this.displayActivityChart(eventsData)
    this.displayRepositoriesTable(this.filteredRepositories)
    this.displayActivityTimeline(this.filteredActivities)
    this.displayInsights(userData, reposData)
    this.displayRecommendations(userData, reposData)
  }

  displayUserProfile(user) {
    document.getElementById("userAvatar").src = user.avatar_url
    document.getElementById("userName").textContent = user.name || user.login
    document.getElementById("userLogin").textContent = `@${user.login}`
    document.getElementById("userBio").textContent = user.bio || "No bio available"

    document.getElementById("userLocation").innerHTML =
      `<i class="fas fa-map-marker-alt"></i> ${user.location || "Not specified"}`
    document.getElementById("userCompany").innerHTML =
      `<i class="fas fa-building"></i> ${user.company || "Not specified"}`
    document.getElementById("joinDate").innerHTML =
      `<i class="fas fa-calendar"></i> Joined ${this.formatDate(user.created_at)}`

    // Set up GitHub profile link
    document.getElementById("viewGithubBtn").onclick = () => {
      window.open(user.html_url, "_blank")
    }
  }

  displayMetrics(userData, reposData) {
    const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0)
    const totalForks = reposData.reduce((sum, repo) => sum + repo.forks_count, 0)

    this.animateCounter("followersCount", userData.followers)
    this.animateCounter("reposCount", userData.public_repos)
    this.animateCounter("starsCount", totalStars)
    this.animateCounter("forksCount", totalForks)
  }

  displayLanguageChart(repos) {
    const languages = {}
    repos.forEach((repo) => {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + repo.size
      }
    })

    const sortedLanguages = Object.entries(languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)

    if (this.currentChartView === "pie") {
      this.renderPieChart(sortedLanguages)
    } else {
      this.renderBarChart(sortedLanguages)
    }
    this.renderLanguageLegend(sortedLanguages)
  }

  renderPieChart(languages) {
    const canvas = document.getElementById("languageCanvas")
    const ctx = canvas.getContext("2d")
    const themeColors = this.getThemeColors()

    // Set canvas size
    canvas.width = 300
    canvas.height = 300

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = 120

    const total = languages.reduce((sum, [, size]) => sum + size, 0)
    const colors = this.getLanguageColors()

    let currentAngle = -Math.PI / 2

    // Clear canvas with theme-appropriate background
    ctx.fillStyle = themeColors.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    languages.forEach(([language, size], index) => {
      const sliceAngle = (size / total) * 2 * Math.PI

      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
      ctx.closePath()

      ctx.fillStyle = colors[language] || this.getRandomColor(index)
      ctx.fill()

      // Add stroke with theme-appropriate color
      ctx.strokeStyle = themeColors.background
      ctx.lineWidth = 2
      ctx.stroke()

      currentAngle += sliceAngle
    })
  }

  renderBarChart(languages) {
    const canvas = document.getElementById("languageCanvas")
    const ctx = canvas.getContext("2d")
    const themeColors = this.getThemeColors()

    canvas.width = 300
    canvas.height = 300

    const maxValue = Math.max(...languages.map(([, size]) => size))
    const barWidth = canvas.width / languages.length - 10
    const colors = this.getLanguageColors()

    // Clear canvas with theme-appropriate background
    ctx.fillStyle = themeColors.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    languages.forEach(([language, size], index) => {
      const barHeight = (size / maxValue) * (canvas.height - 40)
      const x = index * (barWidth + 10) + 5
      const y = canvas.height - barHeight - 20

      ctx.fillStyle = colors[language] || this.getRandomColor(index)
      ctx.fillRect(x, y, barWidth, barHeight)

      // Add language label with theme-appropriate color
      ctx.fillStyle = themeColors.text
      ctx.font = "10px Inter"
      ctx.textAlign = "center"
      ctx.fillText(language.substring(0, 3), x + barWidth / 2, canvas.height - 5)
    })
  }

  renderLanguageLegend(languages) {
    const legend = document.getElementById("languageLegend")
    const total = languages.reduce((sum, [, size]) => sum + size, 0)
    const colors = this.getLanguageColors()

    legend.innerHTML = languages
      .map(([language, size]) => {
        const percentage = ((size / total) * 100).toFixed(1)
        return `
          <div class="legend-item">
            <div class="legend-color" style="background-color: ${colors[language] || "#6b7280"}"></div>
            <span>${language} (${percentage}%)</span>
          </div>
        `
      })
      .join("")
  }

  displayActivityChart(events) {
    const canvas = document.getElementById("activityCanvas")
    const ctx = canvas.getContext("2d")
    const themeColors = this.getThemeColors()

    canvas.width = 400
    canvas.height = 200

    // Clear canvas with theme-appropriate background
    ctx.fillStyle = themeColors.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (events.length === 0) {
      ctx.fillStyle = themeColors.text
      ctx.font = "14px Inter"
      ctx.textAlign = "center"
      ctx.fillText("No activity data available", canvas.width / 2, canvas.height / 2)
      return
    }

    // Group events by day
    const activityByDay = {}
    const now = new Date()
    const daysToShow = this.currentTimePeriod === "7d" ? 7 : this.currentTimePeriod === "30d" ? 30 : 90

    // Initialize days
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split("T")[0]
      activityByDay[dateKey] = 0
    }

    // Count events per day
    events.forEach((event) => {
      const eventDate = new Date(event.created_at).toISOString().split("T")[0]
      if (activityByDay.hasOwnProperty(eventDate)) {
        activityByDay[eventDate]++
      }
    })

    const days = Object.keys(activityByDay)
    const values = Object.values(activityByDay)
    const maxValue = Math.max(...values, 1)

    const barWidth = canvas.width / days.length - 2
    const maxBarHeight = canvas.height - 40

    days.forEach((day, index) => {
      const value = activityByDay[day]
      const barHeight = (value / maxValue) * maxBarHeight
      const x = index * (barWidth + 2)
      const y = canvas.height - barHeight - 20

      // Draw bar with theme-appropriate colors
      ctx.fillStyle = value > 0 ? themeColors.accent : themeColors.grid
      ctx.fillRect(x, y, barWidth, barHeight)

      // Add value label if there's activity
      if (value > 0) {
        ctx.fillStyle = themeColors.text
        ctx.font = "10px Inter"
        ctx.textAlign = "center"
        ctx.fillText(value.toString(), x + barWidth / 2, y - 5)
      }
    })

    // Add x-axis labels with theme-appropriate color
    ctx.fillStyle = themeColors.text
    ctx.font = "8px Inter"
    ctx.textAlign = "center"
    const labelInterval = Math.ceil(days.length / 5)
    days.forEach((day, index) => {
      if (index % labelInterval === 0) {
        const date = new Date(day)
        const label = `${date.getMonth() + 1}/${date.getDate()}`
        ctx.fillText(label, index * (barWidth + 2) + barWidth / 2, canvas.height - 5)
      }
    })
  }

  displayRepositoriesTable(repos) {
    const tbody = document.getElementById("repositoriesBody")
    const startIndex = (this.currentPage - 1) * this.itemsPerPage
    const endIndex = startIndex + this.itemsPerPage
    const paginatedRepos = repos.slice(startIndex, endIndex)

    tbody.innerHTML = paginatedRepos
      .map(
        (repo) => `
        <tr>
          <td>
            <div>
              <strong>${repo.name}</strong>
              ${repo.fork ? '<i class="fas fa-code-branch" title="Fork" style="margin-left: 8px; color: var(--gray-400);"></i>' : ""}
              <div style="color: var(--gray-600); font-size: var(--font-size-sm); margin-top: 4px;">
                ${repo.description || "No description"}
              </div>
            </div>
          </td>
          <td>
            ${
              repo.language
                ? `
              <div class="language-tag">
                <div class="language-dot" style="background-color: ${this.getLanguageColor(repo.language)}"></div>
                ${repo.language}
              </div>
            `
                : "-"
            }
          </td>
          <td>${this.formatNumber(repo.stargazers_count)}</td>
          <td>${this.formatNumber(repo.forks_count)}</td>
          <td>${this.formatDate(repo.updated_at)}</td>
          <td>
            <a href="${repo.html_url}" target="_blank" class="btn-outline" style="padding: 4px 8px; font-size: 12px;">
              <i class="fas fa-external-link-alt"></i>
              View
            </a>
          </td>
        </tr>
      `,
      )
      .join("")

    this.updatePaginationInfo(repos.length)
    this.updatePaginationButtons(repos.length)
  }

  displayActivityTimeline(events) {
    const timeline = document.getElementById("activityTimeline")
    const displayEvents = events.slice(0, 15)

    if (displayEvents.length === 0) {
      timeline.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--gray-500);">
          <i class="fas fa-clock" style="font-size: 24px; margin-bottom: 8px;"></i>
          <p>No recent activity found</p>
        </div>
      `
      return
    }

    timeline.innerHTML = displayEvents
      .map(
        (event) => `
        <div class="activity-item">
          <div class="activity-icon">
            <i class="${this.getEventIcon(event.type)}"></i>
          </div>
          <div class="activity-content">
            <div class="activity-title">${this.getEventDescription(event)}</div>
            <div class="activity-description">
              <a href="https://github.com/${event.repo.name}" target="_blank" style="color: var(--primary-600); text-decoration: none;">
                ${event.repo.name}
              </a>
            </div>
            <div class="activity-time">${this.getTimeAgo(event.created_at)}</div>
          </div>
        </div>
      `,
      )
      .join("")
  }

  displayInsights(userData, reposData) {
    const languages = {}
    reposData.forEach((repo) => {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1
      }
    })

    const topLanguage = Object.entries(languages).sort(([, a], [, b]) => b - a)[0]
    const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0)
    const recentRepos = reposData.filter((repo) => {
      const updated = new Date(repo.updated_at)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return updated > thirtyDaysAgo
    }).length

    document.getElementById("primaryLanguage").textContent = topLanguage ? topLanguage[0] : "Various"
    document.getElementById("codingFrequency").textContent =
      recentRepos > 5 ? "High" : recentRepos > 2 ? "Medium" : "Low"
    document.getElementById("collaborationLevel").textContent =
      totalStars > 100 ? "High" : totalStars > 20 ? "Medium" : "Low"
    document.getElementById("projectDiversity").textContent =
      Object.keys(languages).length > 5 ? "High" : Object.keys(languages).length > 2 ? "Medium" : "Low"
  }

  displayRecommendations(userData, reposData) {
    const recommendations = []
    const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0)
    const hasReadme = reposData.some((repo) => repo.name.toLowerCase() === userData.login.toLowerCase())

    if (totalStars < 50) {
      recommendations.push({
        title: "Improve Repository Visibility",
        description: "Add detailed README files, descriptions, and topics to attract more stars and contributors.",
      })
    }

    if (!userData.bio) {
      recommendations.push({
        title: "Complete Your Profile",
        description: "Add a bio, location, and website to make your GitHub profile more professional and discoverable.",
      })
    }

    if (!hasReadme) {
      recommendations.push({
        title: "Create a Profile README",
        description:
          "Create a special repository with your username to showcase your skills and projects on your profile.",
      })
    }

    if (reposData.length < 5) {
      recommendations.push({
        title: "Build More Projects",
        description: "Create more repositories to showcase your skills and expertise in different programming areas.",
      })
    }

    const recentActivity = reposData.filter((repo) => {
      const updated = new Date(repo.updated_at)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return updated > thirtyDaysAgo
    }).length

    if (recentActivity === 0) {
      recommendations.push({
        title: "Stay Active",
        description:
          "Regular commits and updates show that you're an active developer. Try to contribute code regularly.",
      })
    }

    const container = document.getElementById("recommendationsList")

    if (recommendations.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--gray-500);">
          <i class="fas fa-trophy" style="font-size: 24px; margin-bottom: 8px; color: var(--success-500);"></i>
          <p>Excellent profile! Keep up the great work!</p>
        </div>
      `
      return
    }

    container.innerHTML = recommendations
      .map(
        (rec) => `
        <div class="recommendation-item">
          <div class="recommendation-title">${rec.title}</div>
          <div class="recommendation-description">${rec.description}</div>
        </div>
      `,
      )
      .join("")
  }

  // Search History Management
  addToSearchHistory(userData) {
    const historyItem = {
      login: userData.login,
      name: userData.name,
      avatar_url: userData.avatar_url,
      timestamp: Date.now(),
    }

    // Remove if already exists
    this.searchHistory = this.searchHistory.filter((item) => item.login !== userData.login)

    // Add to beginning
    this.searchHistory.unshift(historyItem)

    // Keep only last 10
    this.searchHistory = this.searchHistory.slice(0, 10)

    localStorage.setItem("github-search-history", JSON.stringify(this.searchHistory))
    this.displayRecentProfiles()
  }

  displayRecentProfiles() {
    const container = document.getElementById("recentProfiles")

    if (this.searchHistory.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--gray-500); font-size: var(--font-size-sm);">
          No recent profiles
        </div>
      `
      return
    }

    container.innerHTML = this.searchHistory
      .slice(0, 5)
      .map(
        (item) => `
        <div class="profile-item" data-username="${item.login}">
          <img src="${item.avatar_url}" alt="${item.login}" />
          <div class="profile-info">
            <span class="profile-name">${item.login}</span>
            <span class="profile-time">${this.getTimeAgo(new Date(item.timestamp).toISOString())}</span>
          </div>
        </div>
      `,
      )
      .join("")

    // Add click handlers
    container.querySelectorAll(".profile-item").forEach((item) => {
      item.addEventListener("click", () => {
        document.getElementById("usernameInput").value = item.dataset.username
        this.analyzeProfile()
      })
    })
  }

  // Filtering and Sorting
  filterRepositories(searchTerm) {
    let filtered = [...this.repositories]

    if (searchTerm) {
      filtered = filtered.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase())),
      )
    }

    this.filteredRepositories = filtered
    this.currentPage = 1
    this.sortRepositories(this.currentSort)
  }

  sortRepositories(sortBy) {
    this.currentSort = sortBy

    this.filteredRepositories.sort((a, b) => {
      switch (sortBy) {
        case "stars":
          return b.stargazers_count - a.stargazers_count
        case "forks":
          return b.forks_count - a.forks_count
        case "updated":
          return new Date(b.updated_at) - new Date(a.updated_at)
        case "created":
          return new Date(b.created_at) - new Date(a.created_at)
        default:
          return b.stargazers_count - a.stargazers_count
      }
    })

    this.displayRepositoriesTable(this.filteredRepositories)
  }

  filterActivity(type) {
    this.currentActivityFilter = type

    if (type === "all") {
      this.filteredActivities = [...this.activities]
    } else {
      const eventTypeMap = {
        push: "PushEvent",
        pr: "PullRequestEvent",
        issues: "IssuesEvent",
      }

      this.filteredActivities = this.activities.filter((event) => event.type === eventTypeMap[type])
    }

    this.displayActivityTimeline(this.filteredActivities)
  }

  toggleChartView(view) {
    this.currentChartView = view
    if (this.repositories.length > 0) {
      this.displayLanguageChart(this.repositories)
    }
  }

  filterByTime(period) {
    this.currentTimePeriod = period
    if (this.activities.length > 0) {
      this.displayActivityChart(this.activities)
    }
  }

  updateActiveFilter(activeElement, selector) {
    document.querySelectorAll(selector).forEach((btn) => btn.classList.remove("active"))
    activeElement.classList.add("active")
  }

  // Pagination
  changePage(direction) {
    const totalPages = Math.ceil(this.filteredRepositories.length / this.itemsPerPage)
    const newPage = this.currentPage + direction

    if (newPage >= 1 && newPage <= totalPages) {
      this.currentPage = newPage
      this.displayRepositoriesTable(this.filteredRepositories)
    }
  }

  updatePaginationInfo(total) {
    const start = (this.currentPage - 1) * this.itemsPerPage + 1
    const end = Math.min(this.currentPage * this.itemsPerPage, total)
    document.getElementById("paginationInfo").textContent = `${start}-${end} of ${total}`
  }

  updatePaginationButtons(total) {
    const totalPages = Math.ceil(total / this.itemsPerPage)
    const prevBtn = document.getElementById("prevPage")
    const nextBtn = document.getElementById("nextPage")

    prevBtn.disabled = this.currentPage <= 1
    nextBtn.disabled = this.currentPage >= totalPages

    // Update page numbers
    const pageNumbers = document.getElementById("pageNumbers")
    const startPage = Math.max(1, this.currentPage - 1)
    const endPage = Math.min(totalPages, startPage + 2)

    pageNumbers.innerHTML = ""
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement("button")
      pageBtn.className = `page-btn ${i === this.currentPage ? "active" : ""}`
      pageBtn.textContent = i
      pageBtn.addEventListener("click", () => {
        this.currentPage = i
        this.displayRepositoriesTable(this.filteredRepositories)
      })
      pageNumbers.appendChild(pageBtn)
    }
  }

  // Global Search
  handleGlobalSearch(query) {
    if (!query) return

    // Search in current data if available
    if (this.repositories.length > 0) {
      this.filterRepositories(query)
    }
  }

  // Utility functions
  animateCounter(elementId, target) {
    const element = document.getElementById(elementId)
    const duration = 1000
    const start = 0
    const increment = target / (duration / 16)
    let current = start

    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        current = target
        clearInterval(timer)
      }
      element.textContent = this.formatNumber(Math.floor(current))
    }, 16)
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  getTimeAgo(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) return "Just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`
  }

  getEventDescription(event) {
    const eventTypes = {
      PushEvent: "Pushed code to",
      CreateEvent: "Created",
      WatchEvent: "Starred",
      ForkEvent: "Forked",
      IssuesEvent: "Opened issue in",
      PullRequestEvent: "Created pull request in",
      ReleaseEvent: "Published release in",
      PublicEvent: "Made public",
      DeleteEvent: "Deleted branch in",
    }
    return eventTypes[event.type] || event.type.replace("Event", "")
  }

  getEventIcon(eventType) {
    const icons = {
      PushEvent: "fas fa-code",
      CreateEvent: "fas fa-plus",
      WatchEvent: "fas fa-star",
      ForkEvent: "fas fa-code-branch",
      IssuesEvent: "fas fa-exclamation-circle",
      PullRequestEvent: "fas fa-git-alt",
      ReleaseEvent: "fas fa-tag",
      PublicEvent: "fas fa-globe",
      DeleteEvent: "fas fa-trash",
    }
    return icons[eventType] || "fas fa-circle"
  }

  getLanguageColors() {
    return {
      JavaScript: "#f1e05a",
      Python: "#3572A5",
      Java: "#b07219",
      TypeScript: "#2b7489",
      "C++": "#f34b7d",
      C: "#555555",
      "C#": "#239120",
      PHP: "#4F5D95",
      Ruby: "#701516",
      Go: "#00ADD8",
      Rust: "#dea584",
      Swift: "#ffac45",
      HTML: "#e34c26",
      CSS: "#1572B6",
      Shell: "#89e051",
      Vue: "#4FC08D",
      Dart: "#00B4AB",
      Scala: "#c22d40",
      R: "#198CE7",
      Perl: "#0298c3",
    }
  }

  getLanguageColor(language) {
    const colors = this.getLanguageColors()
    return colors[language] || "#6b7280"
  }

  getRandomColor(index) {
    const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"]
    return colors[index % colors.length]
  }

  // UI State Management
  showLoading() {
    document.getElementById("searchSection").classList.add("hidden")
    document.getElementById("loadingState").classList.remove("hidden")
  }

  hideLoading() {
    document.getElementById("loadingState").classList.add("hidden")
  }

  showError(message) {
    document.getElementById("errorMessage").textContent = message
    document.getElementById("errorState").classList.remove("hidden")
  }

  hideError() {
    document.getElementById("errorState").classList.add("hidden")
  }

  showDashboard() {
    document.getElementById("dashboardContent").classList.remove("hidden")
  }

  hideDashboard() {
    document.getElementById("dashboardContent").classList.add("hidden")
  }

  updateLoadingProgress(status, percentage) {
    document.getElementById("loadingStatus").textContent = status
    document.getElementById("progressFill").style.width = `${percentage}%`
  }

  // Export and Share
  exportData() {
    if (!this.currentUser) {
      this.showToast("No profile data to export", "warning")
      return
    }

    const data = {
      user: this.currentUser,
      repositories: this.repositories,
      activities: this.activities,
      insights: {
        totalStars: this.repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0),
        totalForks: this.repositories.reduce((sum, repo) => sum + repo.forks_count, 0),
        languages: this.getLanguageStats(),
        topRepositories: this.repositories.slice(0, 10),
      },
      exported_at: new Date().toISOString(),
      exported_by: "GitHub Analytics Dashboard",
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${this.currentUser.login}-github-analysis.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    this.showToast("Data exported successfully!", "success")
  }

  // Quick Export functionality
  handleQuickExport() {
    if (!this.currentUser) {
      this.showAdvancedExportModal()
    } else {
      this.exportData()
    }
  }

  // Quick Share functionality
  handleQuickShare() {
    if (!this.currentUser) {
      this.showShareOptionsModal()
    } else {
      this.shareProfile()
    }
  }

  // Show advanced export modal when no profile is loaded
  showAdvancedExportModal() {
    const modal = document.createElement("div")
    modal.className = "modal"
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Export Options</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="export-options">
            <div class="export-option" data-type="history">
              <i class="fas fa-history"></i>
              <div>
                <h4>Search History</h4>
                <p>Export your recent profile searches</p>
              </div>
            </div>
            <div class="export-option" data-type="bookmarks">
              <i class="fas fa-bookmark"></i>
              <div>
                <h4>Bookmarked Profiles</h4>
                <p>Export your saved profiles</p>
              </div>
            </div>
            <div class="export-option" data-type="settings">
              <i class="fas fa-cog"></i>
              <div>
                <h4>Dashboard Settings</h4>
                <p>Export your preferences and configuration</p>
              </div>
            </div>
            <div class="export-option" data-type="all">
              <i class="fas fa-database"></i>
              <div>
                <h4>All Data</h4>
                <p>Export everything (history, bookmarks, settings)</p>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary modal-close-btn">Cancel</button>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(modal)

    // Add event listeners
    modal.querySelector(".modal-close").addEventListener("click", () => this.closeModal(modal))
    modal.querySelector(".modal-close-btn").addEventListener("click", () => this.closeModal(modal))

    modal.querySelectorAll(".export-option").forEach((option) => {
      option.addEventListener("click", () => {
        const type = option.dataset.type
        this.exportDataByType(type)
        this.closeModal(modal)
      })
    })

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.closeModal(modal)
    })
  }

  // Show share options modal when no profile is loaded
  showShareOptionsModal() {
    const modal = document.createElement("div")
    modal.className = "modal"
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Share Options</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="share-options">
            <div class="share-option" data-type="dashboard">
              <i class="fas fa-chart-line"></i>
              <div>
                <h4>Share Dashboard</h4>
                <p>Share a link to this GitHub Analytics Dashboard</p>
              </div>
            </div>
            <div class="share-option" data-type="invite">
              <i class="fas fa-user-plus"></i>
              <div>
                <h4>Invite Others</h4>
                <p>Invite colleagues to use this analytics tool</p>
              </div>
            </div>
            <div class="share-option" data-type="feedback">
              <i class="fas fa-comment"></i>
              <div>
                <h4>Share Feedback</h4>
                <p>Help us improve by sharing your thoughts</p>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary modal-close-btn">Cancel</button>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(modal)

    // Add event listeners
    modal.querySelector(".modal-close").addEventListener("click", () => this.closeModal(modal))
    modal.querySelector(".modal-close-btn").addEventListener("click", () => this.closeModal(modal))

    modal.querySelectorAll(".share-option").forEach((option) => {
      option.addEventListener("click", () => {
        const type = option.dataset.type
        this.handleShareByType(type)
        this.closeModal(modal)
      })
    })

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.closeModal(modal)
    })
  }

  // Export data by type
  exportDataByType(type) {
    let data = {}
    let filename = ""

    switch (type) {
      case "history":
        data = {
          searchHistory: this.searchHistory,
          exported_at: new Date().toISOString(),
          type: "search_history",
        }
        filename = "github-search-history.json"
        this.showToast("Search history exported!", "success")
        break

      case "bookmarks":
        data = {
          bookmarkedProfiles: this.bookmarkedProfiles,
          exported_at: new Date().toISOString(),
          type: "bookmarks",
        }
        filename = "github-bookmarks.json"
        this.showToast("Bookmarks exported!", "success")
        break

      case "settings":
        data = {
          userPreferences: this.userPreferences,
          theme: localStorage.getItem("github-theme"),
          language: this.currentLanguage,
          customDashboard: this.customDashboard,
          exported_at: new Date().toISOString(),
          type: "settings",
        }
        filename = "github-dashboard-settings.json"
        this.showToast("Settings exported!", "success")
        break

      case "all":
        data = {
          searchHistory: this.searchHistory,
          bookmarkedProfiles: this.bookmarkedProfiles,
          userPreferences: this.userPreferences,
          theme: localStorage.getItem("github-theme"),
          language: this.currentLanguage,
          customDashboard: this.customDashboard,
          exported_at: new Date().toISOString(),
          type: "complete_backup",
        }
        filename = "github-dashboard-backup.json"
        this.showToast("Complete data backup exported!", "success")
        break
    }

    // Create and download file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Handle share by type
  handleShareByType(type) {
    switch (type) {
      case "dashboard":
        const dashboardUrl = window.location.href
        if (navigator.share) {
          navigator
            .share({
              title: "GitHub Analytics Dashboard",
              text: "Check out this powerful GitHub profile analytics tool!",
              url: dashboardUrl,
            })
            .then(() => {
              this.showToast("Dashboard link shared!", "success")
            })
            .catch(() => {
              this.fallbackShare(dashboardUrl)
            })
        } else {
          this.fallbackShare(dashboardUrl)
        }
        break

      case "invite":
        const inviteText =
          "Hey! I found this amazing GitHub Analytics Dashboard that provides deep insights into GitHub profiles. Check it out: " +
          window.location.href
        if (navigator.share) {
          navigator
            .share({
              title: "GitHub Analytics Dashboard Invitation",
              text: inviteText,
            })
            .then(() => {
              this.showToast("Invitation sent!", "success")
            })
            .catch(() => {
              navigator.clipboard.writeText(inviteText).then(() => {
                this.showToast("Invitation text copied to clipboard!", "success")
              })
            })
        } else {
          navigator.clipboard.writeText(inviteText).then(() => {
            this.showToast("Invitation text copied to clipboard!", "success")
          })
        }
        break

      case "feedback":
        const feedbackUrl =
          "mailto:feedback@example.com?subject=GitHub Analytics Dashboard Feedback&body=I'd like to share my feedback about the GitHub Analytics Dashboard:"
        window.open(feedbackUrl, "_blank")
        this.showToast("Feedback email opened!", "info")
        break
    }
  }

  // Close modal helper
  closeModal(modal) {
    modal.classList.add("fade-out")
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal)
      }
    }, 300)
  }

  shareProfile() {
    if (!this.currentUser) {
      this.showToast("No profile to share", "warning")
      return
    }

    const url = `${window.location.origin}${window.location.pathname}?user=${this.currentUser.login}`
    const title = `${this.currentUser.name || this.currentUser.login}'s GitHub Analysis`
    const text = `Check out ${this.currentUser.name || this.currentUser.login}'s GitHub profile analysis`

    if (navigator.share) {
      navigator
        .share({
          title: title,
          text: text,
          url: url,
        })
        .then(() => {
          this.showToast("Profile shared successfully!", "success")
        })
        .catch(() => {
          this.fallbackShare(url)
        })
    } else {
      this.fallbackShare(url)
    }
  }

  fallbackShare(url) {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        this.showToast("Profile link copied to clipboard!", "success")
      })
      .catch(() => {
        this.showToast("Failed to copy link", "error")
      })
  }

  getLanguageStats() {
    const languages = {}
    this.repositories.forEach((repo) => {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + repo.size
      }
    })
    return languages
  }

  // Theme Management
  toggleTheme() {
    const body = document.body
    const themeToggle = document.getElementById("themeToggle")
    const isDarkMode = body.classList.contains("dark-theme")

    if (isDarkMode) {
      // Switch to light mode
      body.classList.remove("dark-theme")
      themeToggle.innerHTML = '<i class="fas fa-moon"></i>'
      themeToggle.setAttribute("title", "Switch to dark mode")
      localStorage.setItem("github-theme", "light")
      this.showToast("Switched to light mode", "success")
    } else {
      // Switch to dark mode
      body.classList.add("dark-theme")
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>'
      themeToggle.setAttribute("title", "Switch to light mode")
      localStorage.setItem("github-theme", "dark")
      this.showToast("Switched to dark mode", "success")
    }

    // Add smooth transition effect
    body.style.transition = "background-color 0.3s ease, color 0.3s ease"
    setTimeout(() => {
      body.style.transition = ""
    }, 300)

    // Update charts and visualizations for new theme
    this.updateChartsForTheme()

    // Dispatch custom event for theme change
    window.dispatchEvent(
      new CustomEvent("themeChanged", {
        detail: { theme: isDarkMode ? "light" : "dark" },
      }),
    )
  }

  loadTheme() {
    const savedTheme = localStorage.getItem("github-theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const themeToggle = document.getElementById("themeToggle")

    // Determine theme: saved preference > system preference > default (light)
    const shouldUseDark = savedTheme === "dark" || (savedTheme === null && prefersDark)

    if (shouldUseDark) {
      document.body.classList.add("dark-theme")
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>'
      themeToggle.setAttribute("title", "Switch to light mode")
    } else {
      document.body.classList.remove("dark-theme")
      themeToggle.innerHTML = '<i class="fas fa-moon"></i>'
      themeToggle.setAttribute("title", "Switch to dark mode")
    }

    // Listen for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (localStorage.getItem("github-theme") === null) {
        // Only auto-switch if user hasn't set a preference
        if (e.matches) {
          document.body.classList.add("dark-theme")
          themeToggle.innerHTML = '<i class="fas fa-sun"></i>'
          themeToggle.setAttribute("title", "Switch to light mode")
        } else {
          document.body.classList.remove("dark-theme")
          themeToggle.innerHTML = '<i class="fas fa-moon"></i>'
          themeToggle.setAttribute("title", "Switch to dark mode")
        }
        this.updateChartsForTheme()
      }
    })
  }

  // Update charts and visualizations when theme changes
  updateChartsForTheme() {
    if (this.repositories && this.repositories.length > 0) {
      // Redraw language chart with theme-appropriate colors
      this.displayLanguageChart(this.repositories)
    }

    if (this.activities && this.activities.length > 0) {
      // Redraw activity chart with theme-appropriate colors
      this.displayActivityChart(this.activities)
    }

    // Update any other visualizations that need theme updates
    const analyticsView = document.getElementById("analyticsView")
    if (analyticsView && !analyticsView.classList.contains("hidden")) {
      setTimeout(() => {
        const canvas = document.getElementById("languageTrendChart")
        if (canvas) {
          const ctx = canvas.getContext("2d")
          this.drawLanguageTrendChart(ctx, canvas)
        }
      }, 100)
    }
  }

  // Get theme-appropriate colors for charts
  getThemeColors() {
    const isDark = document.body.classList.contains("dark-theme")

    return {
      background: isDark ? "#1f2937" : "#ffffff",
      text: isDark ? "#f9fafb" : "#374151",
      grid: isDark ? "#374151" : "#e5e7eb",
      accent: isDark ? "#60a5fa" : "#3b82f6",
    }
  }

  // Toast Notifications
  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer")
    const toast = document.createElement("div")
    toast.className = `toast ${type}`

    const icons = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-circle",
      warning: "fas fa-exclamation-triangle",
      info: "fas fa-info-circle",
    }

    toast.innerHTML = `
      <div class="toast-icon">
        <i class="${icons[type]}"></i>
      </div>
      <div class="toast-content">
        <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">
        <i class="fas fa-times"></i>
      </button>
    `

    container.appendChild(toast)

    // Show toast
    setTimeout(() => toast.classList.add("show"), 100)

    // Auto remove
    const autoRemove = setTimeout(() => this.removeToast(toast), 5000)

    // Manual close
    toast.querySelector(".toast-close").addEventListener("click", () => {
      clearTimeout(autoRemove)
      this.removeToast(toast)
    })
  }

  removeToast(toast) {
    toast.classList.remove("show")
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast)
      }
    }, 300)
  }

  // Navigation System
  switchView(viewName) {
    this.currentView = viewName

    // Hide all views
    document.getElementById("searchSection").classList.add("hidden")
    document.getElementById("dashboardContent").classList.add("hidden")
    document.getElementById("profilesView")?.classList.add("hidden")
    document.getElementById("repositoriesView")?.classList.add("hidden")
    document.getElementById("analyticsView")?.classList.add("hidden")

    switch (viewName) {
      case "dashboard":
        if (this.currentUser) {
          document.getElementById("dashboardContent").classList.remove("hidden")
        } else {
          document.getElementById("searchSection").classList.remove("hidden")
        }
        break

      case "profiles":
        this.showProfilesView()
        break

      case "repositories":
        this.showRepositoriesView()
        break

      case "analytics":
        this.showAnalyticsView()
        break
    }
  }

  updateActiveNav(activeNav) {
    document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"))
    activeNav.classList.add("active")
  }

  showProfilesView() {
    let profilesView = document.getElementById("profilesView")
    if (!profilesView) {
      profilesView = this.createProfilesView()
    }
    profilesView.classList.remove("hidden")
  }

  showRepositoriesView() {
    let repositoriesView = document.getElementById("repositoriesView")
    if (!repositoriesView) {
      repositoriesView = this.createRepositoriesView()
    }
    repositoriesView.classList.remove("hidden")
  }

  showAnalyticsView() {
    let analyticsView = document.getElementById("analyticsView")
    if (!analyticsView) {
      analyticsView = this.createAnalyticsView()
    }
    analyticsView.classList.remove("hidden")
  }

  createProfilesView() {
    const view = document.createElement("div")
    view.id = "profilesView"
    view.className = "view-content"
    view.innerHTML = `
    <div class="view-header">
      <h1>Profile Management</h1>
      <p>Manage and compare GitHub profiles</p>
    </div>
    
    <div class="profiles-grid">
      <div class="profile-card-large">
        <h3>Search History</h3>
        <div id="profilesSearchHistory" class="profiles-list">
          ${this.searchHistory
            .map(
              (profile) => `
            <div class="profile-item-large" data-username="${profile.login}">
              <img src="${profile.avatar_url}" alt="${profile.login}" />
              <div class="profile-details-large">
                <h4>${profile.name || profile.login}</h4>
                <p>@${profile.login}</p>
                <span class="profile-date">${this.getTimeAgo(new Date(profile.timestamp).toISOString())}</span>
              </div>
              <button class="btn-outline analyze-profile-btn" data-username="${profile.login}">
                <i class="fas fa-chart-line"></i>
                Analyze
              </button>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
      
      <div class="profile-card-large">
        <h3>Quick Actions</h3>
        <div class="quick-actions-grid">
          <button class="action-card-large" id="bulkAnalyzeBtn">
            <i class="fas fa-users"></i>
            <span>Bulk Analysis</span>
            <p>Analyze multiple profiles</p>
          </button>
          <button class="action-card-large" id="compareProfilesBtn">
            <i class="fas fa-balance-scale"></i>
            <span>Compare Profiles</span>
            <p>Side-by-side comparison</p>
          </button>
          <button class="action-card-large" id="exportAllBtn">
            <i class="fas fa-download"></i>
            <span>Export All Data</span>
            <p>Download all profiles</p>
          </button>
        </div>
      </div>
    </div>
  `

    document.querySelector(".main-content").appendChild(view)

    // Add event listeners
    view.querySelectorAll(".analyze-profile-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const username = e.target.closest("[data-username]").dataset.username
        document.getElementById("usernameInput").value = username
        this.switchView("dashboard")
        this.analyzeProfile()
      })
    })

    return view
  }

  createRepositoriesView() {
    const view = document.createElement("div")
    view.id = "repositoriesView"
    view.className = "view-content"
    view.innerHTML = `
    <div class="view-header">
      <h1>Repository Explorer</h1>
      <p>Explore and analyze repositories</p>
    </div>
    
    <div class="repositories-dashboard">
      <div class="repo-stats-overview">
        <div class="stat-card">
          <h3>Total Repositories</h3>
          <div class="stat-number">${this.repositories.length}</div>
        </div>
        <div class="stat-card">
          <h3>Total Stars</h3>
          <div class="stat-number">${this.repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0)}</div>
        </div>
        <div class="stat-card">
          <h3>Total Forks</h3>
          <div class="stat-number">${this.repositories.reduce((sum, repo) => sum + repo.forks_count, 0)}</div>
        </div>
      </div>
      
      <div class="repo-detailed-table">
        <div class="table-header">
          <h3>All Repositories</h3>
          <div class="table-controls">
            <input type="text" id="repoDetailedSearch" placeholder="Search repositories..." />
            <select id="repoDetailedSort">
              <option value="stars">Sort by Stars</option>
              <option value="forks">Sort by Forks</option>
              <option value="updated">Sort by Updated</option>
              <option value="size">Sort by Size</option>
            </select>
          </div>
        </div>
        <div id="repositoriesDetailedList" class="repositories-detailed-list">
          ${this.repositories
            .slice(0, 20)
            .map(
              (repo) => `
            <div class="repo-card-detailed">
              <div class="repo-header">
                <h4><a href="${repo.html_url}" target="_blank">${repo.name}</a></h4>
                <div class="repo-stats-inline">
                  <span><i class="fas fa-star"></i> ${repo.stargazers_count}</span>
                  <span><i class="fas fa-code-branch"></i> ${repo.forks_count}</span>
                  <span><i class="fas fa-eye"></i> ${repo.watchers_count}</span>
                </div>
              </div>
              <p class="repo-description">${repo.description || "No description"}</p>
              <div class="repo-meta">
                ${
                  repo.language
                    ? `<span class="language-tag"><div class="language-dot" style="background: ${this.getLanguageColor(
                        repo.language,
                      )}"></div>${repo.language}</span>`
                    : ""
                }
                <span class="repo-updated">Updated ${this.formatDate(repo.updated_at)}</span>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `

    document.querySelector(".main-content").appendChild(view)
    return view
  }

  createAnalyticsView() {
    const view = document.createElement("div")
    view.id = "analyticsView"
    view.className = "view-content"
    view.innerHTML = `
    <div class="view-header">
      <h1>Advanced Analytics</h1>
      <p>Deep insights and trends</p>
    </div>
    
    <div class="analytics-dashboard">
      <div class="analytics-grid">
        <div class="analytics-card">
          <h3>Language Trends</h3>
          <div class="trend-chart">
            <canvas id="languageTrendChart" width="300" height="200"></canvas>
          </div>
        </div>
        
        <div class="analytics-card">
          <h3>Activity Heatmap</h3>
          <div class="heatmap-container">
            <div id="activityHeatmap" class="activity-heatmap">
              ${this.generateActivityHeatmap()}
            </div>
          </div>
        </div>
        
        <div class="analytics-card">
          <h3>Repository Growth</h3>
          <div class="growth-metrics">
            <div class="growth-item">
              <span class="growth-label">This Month</span>
              <span class="growth-value">+${Math.floor(Math.random() * 10)}</span>
            </div>
            <div class="growth-item">
              <span class="growth-label">This Year</span>
              <span class="growth-value">+${Math.floor(Math.random() * 50)}</span>
            </div>
            <div class="growth-item">
              <span class="growth-label">Total Growth</span>
              <span class="growth-value">${this.repositories.length}</span>
            </div>
          </div>
        </div>
        
        <div class="analytics-card">
          <h3>Collaboration Network</h3>
          <div class="network-viz">
            <div class="network-node">
              <div class="node-center">${this.currentUser?.login || "User"}</div>
              <div class="node-connections">
                ${this.repositories
                  .slice(0, 5)
                  .map(
                    (repo) => `
                  <div class="connection-node">${repo.name}</div>
                `,
                  )
                  .join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

    document.querySelector(".main-content").appendChild(view)

    // Draw language trend chart
    setTimeout(() => {
      const canvas = document.getElementById("languageTrendChart")
      if (canvas) {
        const ctx = canvas.getContext("2d")
        this.drawLanguageTrendChart(ctx, canvas)
      }
    }, 100)

    return view
  }

  generateActivityHeatmap() {
    const days = 365
    const today = new Date()
    let heatmapHTML = ""

    for (let i = days; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const activity = Math.floor(Math.random() * 5)
      heatmapHTML += `<div class="heatmap-day" data-level="${activity}" title="${date.toDateString()}: ${activity} contributions"></div>`
    }

    return heatmapHTML
  }

  drawLanguageTrendChart(ctx, canvas) {
    const languages = Object.entries(this.getLanguageStats()).slice(0, 5)
    const colors = this.getLanguageColors()

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw trend lines for each language
    languages.forEach(([language, value], index) => {
      const y = 50 + index * 30
      const maxWidth = canvas.width - 100
      const width = (value / Math.max(...languages.map(([, v]) => v))) * maxWidth

      ctx.fillStyle = colors[language] || this.getRandomColor(index)
      ctx.fillRect(80, y, width, 20)

      ctx.fillStyle = "#374151"
      ctx.font = "12px Inter"
      ctx.textAlign = "right"
      ctx.fillText(language, 75, y + 15)
    })
  }

  // AI-Powered Insights
  async generateAIInsights(userData, reposData) {
    const insights = {
      developerPersonality: this.analyzeDeveloperPersonality(userData, reposData),
      careerSuggestions: this.generateCareerSuggestions(userData, reposData),
      skillGaps: this.identifySkillGaps(reposData),
      marketValue: this.calculateMarketValue(userData, reposData),
      collaborationStyle: this.analyzeCollaborationStyle(reposData),
      innovationScore: this.calculateInnovationScore(reposData),
      mentorshipPotential: this.assessMentorshipPotential(userData, reposData),
    }

    this.aiInsights = insights
    return insights
  }

  // Voice Commands
  initializeVoiceCommands() {
    if ("webkitSpeechRecognition" in window) {
      const recognition = new webkitSpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase()
        this.processVoiceCommand(command)
      }

      this.voiceRecognition = recognition
    }
  }

  processVoiceCommand(command) {
    const commands = {
      "analyze profile": () => document.getElementById("analyzeBtn").click(),
      "export data": () => this.exportData(),
      "toggle theme": () => this.toggleTheme(),
      "show repositories": () => this.switchView("repositories"),
      "show analytics": () => this.switchView("analytics"),
      "search for": (query) => {
        const username = command.split("search for ")[1]
        if (username) {
          document.getElementById("usernameInput").value = username
          this.analyzeProfile()
        }
      },
    }

    Object.keys(commands).forEach((cmd) => {
      if (command.includes(cmd)) {
        commands[cmd](command)
        this.showToast(`Voice command executed: ${cmd}`, "success")
      }
    })
  }

  // Real-time Updates
  enableRealTimeUpdates() {
    if (this.currentUser) {
      this.realTimeInterval = setInterval(async () => {
        try {
          const updatedData = await this.fetchUserData(this.currentUser.login)
          if (JSON.stringify(updatedData) !== JSON.stringify(this.currentUser)) {
            this.currentUser = updatedData
            this.displayUserProfile(updatedData)
            this.showToast("Profile updated in real-time!", "info")
          }
        } catch (error) {
          console.log("Real-time update failed:", error)
        }
      }, 300000) // 5 minutes
    }
  }

  // Advanced Analytics
  calculateDeveloperScore(userData, reposData) {
    let score = 0

    // Follower influence (max 25 points)
    score += Math.min(userData.followers / 100, 25)

    // Repository quality (max 30 points)
    const avgStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0) / reposData.length
    score += Math.min(avgStars / 10, 30)

    // Activity consistency (max 20 points)
    const recentActivity = reposData.filter((repo) => {
      const updated = new Date(repo.updated_at)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      return updated > sixMonthsAgo
    }).length
    score += Math.min(recentActivity * 2, 20)

    // Language diversity (max 15 points)
    const languages = new Set(reposData.map((repo) => repo.language).filter(Boolean))
    score += Math.min(languages.size * 2, 15)

    // Open source contribution (max 10 points)
    const forkedRepos = reposData.filter((repo) => repo.fork).length
    score += Math.min(forkedRepos, 10)

    return Math.round(score)
  }

  // Achievement System
  checkAchievements(userData, reposData) {
    const achievements = []

    if (userData.followers > 1000)
      achievements.push({
        id: "influencer",
        title: "Influencer",
        description: "Has over 1000 followers",
        icon: "fas fa-star",
        rarity: "gold",
      })

    if (reposData.length > 50)
      achievements.push({
        id: "prolific",
        title: "Prolific Developer",
        description: "Created over 50 repositories",
        icon: "fas fa-code",
        rarity: "silver",
      })

    const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0)
    if (totalStars > 10000)
      achievements.push({
        id: "rockstar",
        title: "Open Source Rockstar",
        description: "Earned over 10,000 stars",
        icon: "fas fa-rocket",
        rarity: "platinum",
      })

    const languages = new Set(reposData.map((repo) => repo.language).filter(Boolean))
    if (languages.size > 10)
      achievements.push({
        id: "polyglot",
        title: "Programming Polyglot",
        description: "Uses over 10 programming languages",
        icon: "fas fa-globe",
        rarity: "gold",
      })

    return achievements
  }

  // Collaboration Network Analysis
  async analyzeCollaborationNetwork(username) {
    try {
      const collaborators = new Set()
      const organizations = new Set()

      // Analyze repository collaborators
      for (const repo of this.repositories.slice(0, 10)) {
        try {
          const contributors = await fetch(`${this.baseURL}/repos/${username}/${repo.name}/contributors`)
          if (contributors.ok) {
            const data = await contributors.json()
            data.forEach((contributor) => {
              if (contributor.login !== username) {
                collaborators.add(contributor.login)
              }
            })
          }
        } catch (error) {
          console.log("Failed to fetch contributors for", repo.name)
        }
      }

      // Get user organizations
      try {
        const orgs = await fetch(`${this.baseURL}/users/${username}/orgs`)
        if (orgs.ok) {
          const orgData = await orgs.json()
          orgData.forEach((org) => organizations.add(org.login))
        }
      } catch (error) {
        console.log("Failed to fetch organizations")
      }

      return {
        collaborators: Array.from(collaborators).slice(0, 20),
        organizations: Array.from(organizations),
        networkSize: collaborators.size + organizations.size,
      }
    } catch (error) {
      return { collaborators: [], organizations: [], networkSize: 0 }
    }
  }

  // Advanced Export Options
  async exportAdvanced(format, data) {
    switch (format) {
      case "pdf":
        await this.exportToPDF(data)
        break
      case "csv":
        this.exportToCSV(data)
        break
      case "xlsx":
        await this.exportToExcel(data)
        break
      case "json":
      default:
        this.exportData()
        break
    }
  }

  async exportToPDF(data) {
    // Create a comprehensive PDF report
    const reportHTML = this.generatePDFReport(data)
    const printWindow = window.open("", "_blank")
    printWindow.document.write(reportHTML)
    printWindow.document.close()
    printWindow.print()
    this.showToast("PDF report generated!", "success")
  }

  // Trending Repositories Discovery
  async discoverTrendingRepos(language = "") {
    try {
      const query = language ? `language:${language}` : ""
      const response = await fetch(`${this.baseURL}/search/repositories?q=${query}&sort=stars&order=desc&per_page=20`)
      if (response.ok) {
        const data = await response.json()
        this.trendingRepos = data.items
        return data.items
      }
    } catch (error) {
      console.error("Failed to fetch trending repos:", error)
    }
    return []
  }

  // Performance Monitoring
  trackPerformance(action, startTime) {
    const endTime = performance.now()
    const duration = endTime - startTime

    if (!this.performanceMetrics[action]) {
      this.performanceMetrics[action] = []
    }

    this.performanceMetrics[action].push(duration)

    // Keep only last 10 measurements
    if (this.performanceMetrics[action].length > 10) {
      this.performanceMetrics[action].shift()
    }

    // Show warning if performance is degrading
    const avgTime = this.performanceMetrics[action].reduce((a, b) => a + b, 0) / this.performanceMetrics[action].length
    if (avgTime > 5000) {
      // 5 seconds
      this.showToast(`Performance warning: ${action} is taking ${Math.round(avgTime / 1000)}s`, "warning")
    }
  }

  // Custom Dashboard Builder
  createCustomDashboard() {
    const widgets = [
      { id: "profile", title: "Profile Overview", enabled: true },
      { id: "metrics", title: "Key Metrics", enabled: true },
      { id: "languages", title: "Language Chart", enabled: true },
      { id: "activity", title: "Activity Timeline", enabled: true },
      { id: "repositories", title: "Top Repositories", enabled: true },
      { id: "insights", title: "AI Insights", enabled: false },
      { id: "achievements", title: "Achievements", enabled: false },
      { id: "network", title: "Collaboration Network", enabled: false },
      { id: "trending", title: "Trending Repos", enabled: false },
    ]

    this.showCustomDashboardModal(widgets)
  }

  // Keyboard Shortcuts System
  setupAdvancedKeyboardShortcuts() {
    const shortcuts = {
      "ctrl+k": () => document.getElementById("usernameInput").focus(),
      "ctrl+d": () => this.toggleTheme(), // Theme toggle shortcut
      "ctrl+e": () => this.exportData(),
      "ctrl+s": () => this.saveProfile(),
      "ctrl+shift+c": () => this.compareProfiles.length > 0 && this.showComparisonModal(),
      "ctrl+shift+n": () => this.createCustomDashboard(),
      "ctrl+shift+v": () => this.toggleVoiceCommands(),
      "ctrl+shift+r": () => this.toggleRealTimeUpdates(),
      "ctrl+shift+t": () => this.discoverTrendingRepos(),
      escape: () => this.closeAllModals(),
      "?": () => this.showKeyboardShortcutsHelp(),
    }

    document.addEventListener("keydown", (e) => {
      const key = []
      if (e.ctrlKey) key.push("ctrl")
      if (e.shiftKey) key.push("shift")
      if (e.altKey) key.push("alt")
      key.push(e.key.toLowerCase())

      const shortcut = key.join("+")
      if (shortcuts[shortcut]) {
        e.preventDefault()
        shortcuts[shortcut]()
      }
    })
  }

  // Multi-language Support
  setLanguage(lang) {
    this.currentLanguage = lang
    localStorage.setItem("github-language", lang)
    this.updateUILanguage()
    this.showToast(`Language changed to ${lang.toUpperCase()}`, "success")
  }

  // Offline Mode
  enableOfflineMode() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(() => {
        this.offlineMode = true
        this.showToast("Offline mode enabled", "success")
      })
    }
  }

  // Profile Comparison
  addToComparison(userData) {
    if (this.compareProfiles.length < 3) {
      this.compareProfiles.push(userData)
      this.showToast(`${userData.login} added to comparison`, "success")
      this.updateComparisonUI()
    } else {
      this.showToast("Maximum 3 profiles can be compared", "warning")
    }
  }

  // Bookmark System
  bookmarkProfile(userData) {
    const bookmark = {
      login: userData.login,
      name: userData.name,
      avatar_url: userData.avatar_url,
      bookmarked_at: Date.now(),
    }

    if (!this.bookmarkedProfiles.find((b) => b.login === userData.login)) {
      this.bookmarkedProfiles.push(bookmark)
      localStorage.setItem("github-bookmarks", JSON.stringify(this.bookmarkedProfiles))
      this.showToast("Profile bookmarked!", "success")
    } else {
      this.showToast("Profile already bookmarked", "info")
    }
  }

  // Advanced Search with Filters
  advancedSearch(filters) {
    const { location, language, followers, repositories, company } = filters
    let query = ""

    if (location) query += `location:${location} `
    if (language) query += `language:${language} `
    if (followers) query += `followers:>${followers} `
    if (repositories) query += `repos:>${repositories} `
    if (company) query += `company:${company} `

    return fetch(`${this.baseURL}/search/users?q=${query}&per_page=20`)
  }

  // Code Quality Analysis
  analyzeCodeQuality(reposData) {
    const metrics = {
      avgRepoSize: reposData.reduce((sum, repo) => sum + repo.size, 0) / reposData.length,
      documentationScore: (reposData.filter((repo) => repo.description).length / reposData.length) * 100,
      maintenanceScore:
        (reposData.filter((repo) => {
          const updated = new Date(repo.updated_at)
          const threeMonthsAgo = new Date()
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
          return updated > threeMonthsAgo
        }).length /
          reposData.length) *
        100,
      popularityScore: reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0) / reposData.length,
    }

    return metrics
  }

  // Social Media Integration
  shareToSocialMedia(platform, data) {
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=Check out ${data.name}'s GitHub profile analysis!&url=${window.location.href}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${window.location.href}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${window.location.href}`,
    }

    if (urls[platform]) {
      window.open(urls[platform], "_blank", "width=600,height=400")
    }
  }

  // Notification System
  addNotification(title, message, type = "info", persistent = false) {
    const notification = {
      id: Date.now(),
      title,
      message,
      type,
      persistent,
      timestamp: new Date().toISOString(),
    }

    this.notifications.unshift(notification)
    this.updateNotificationBadge()

    if (!persistent) {
      setTimeout(() => this.removeNotification(notification.id), 5000)
    }
  }

  // Data Visualization Enhancements
  createAdvancedCharts() {
    this.createContributionHeatmap()
    this.createLanguageTrendChart()
    this.createCollaborationNetwork()
    this.createPerformanceMetrics()
  }

  // Machine Learning Predictions
  predictFutureGrowth(userData, reposData) {
    // Simple linear regression for follower growth prediction
    const monthlyGrowth = userData.followers / this.getAccountAgeInMonths(userData.created_at)
    const predictedFollowers = {
      nextMonth: Math.round(userData.followers + monthlyGrowth),
      nextQuarter: Math.round(userData.followers + monthlyGrowth * 3),
      nextYear: Math.round(userData.followers + monthlyGrowth * 12),
    }

    return {
      followers: predictedFollowers,
      confidence: this.calculatePredictionConfidence(userData, reposData),
    }
  }

  // Security Analysis
  analyzeSecurityPractices(reposData) {
    const securityMetrics = {
      hasSecurityPolicy: reposData.some((repo) => repo.name.toLowerCase().includes("security")),
      vulnerabilityAlerts: 0, // Would need GitHub Security API
      dependabotEnabled: 0,
      codeScanning: 0,
      secretScanning: 0,
      securityScore: 0,
    }

    // Calculate overall security score
    securityMetrics.securityScore = Object.values(securityMetrics).reduce(
      (sum, val) => sum + (typeof val === "boolean" ? (val ? 20 : 0) : val),
      0,
    )

    return securityMetrics
  }
}

// Initialize the dashboard
document.addEventListener("DOMContentLoaded", () => {
  new GitHubDashboard()
})
