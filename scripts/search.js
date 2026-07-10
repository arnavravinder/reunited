const getEnvVar = (key, defaultValue = null) => {
  if (window.env && window.env[key]) {
    return window.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return defaultValue;
};

const firebaseConfig = {
  apiKey: getEnvVar('FIREBASE_API_KEY'),
  authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN'),
  databaseURL: getEnvVar('FIREBASE_DATABASE_URL'),
  projectId: getEnvVar('FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('FIREBASE_APP_ID')
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

const AI_ENDPOINT = getEnvVar('AI_DEV_PROXY') || '/api/ai';
const GEMINI_DIRECT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GEMINI_DIRECT_MODEL = 'gemini-2.5-flash';

const requestAIChat = async (payload) => {
  const proxyResponse = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => null);

  const proxyMissing = !proxyResponse || proxyResponse.status === 404 || proxyResponse.status === 405;
  if (!proxyMissing) return proxyResponse;

  const geminiKey = getEnvVar('GEMINI_API_KEY');
  if (!geminiKey) {
    if (proxyResponse) return proxyResponse;
    throw new Error('AI proxy unreachable');
  }
  return fetch(GEMINI_DIRECT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${geminiKey}`
    },
    body: JSON.stringify({ model: GEMINI_DIRECT_MODEL, ...payload })
  });
};

const app = Vue.createApp({
  data() {
    return {
      user: null,
      authError: null,
      showLoginModal: false,
      magicLinkEmail: '',
      magicLinkSending: false,
      magicLinkSent: false,
      isLoading: false,
      authChecked: false,
      searchError: '',
      mobileMenuOpen: false,
      accountMenuOpen: false,
      viewMode: 'grid',
      searchPerformed: false,
      aiAssisted: false,
      aiSearching: false,
      aiCancelled: false,
      resultsAnimating: false,
      topMatchIds: [],
      aiRankedIds: [],
      gridCols: 4,
      resizeTimer: null,
      lastSearchParams: null,
      shouldScrollToResults: false,
      searchQuery: '',
      selectedItemType: '',
      otherItemType: '',
      selectedLocation: '',
      selectedDate: '',
      searchDateRange: { from: '', to: '' },
      sortOption: 'relevance',
      currentPage: 1,
      itemsPerPage: 12,
      totalPages: 1,
      searchResults: [],
      allItems: [],
      itemCache: [],
      userProfile: {
        displayName: '',
        email: ''
      },
      selectedItem: null,
      itemValuation: null,
      messageModal: { visible: false, title: '', text: '', actionLabel: '', actionHref: '' },
      showClaimModal: false,
      showClaimCodeModal: false,
      claimItem: null,
      claimForm: { description: '', contactInfo: '' },
      isSubmittingClaim: false,
      itemTypes: [
        'Apparel', 'Jacket', 'Electronics', 'Water Bottle',
        'Sports Equipment', 'Accessories', 'Uniform'
      ],
      locations: [
        'Classroom', 'Primary School Block', 'Middle School Block', 'Hub',
        'Hangout Areas', 'Sports Field', 'Football Field', 'Bus'
      ]
    };
  },
  mounted() {
    this.precacheAllItems();

    const incomingQuery = new URLSearchParams(window.location.search).get('q');
    if (incomingQuery) {
      this.searchQuery = incomingQuery;
      this.pendingUrlSearch = true;
    }

    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
      this.authChecked = true;
      if (user) {
        this.loadUserProfile();
        if (this.pendingUrlSearch) {
          this.pendingUrlSearch = false;
          this.performSearch();
        }
      }
    });

    if (this.$refs.datePicker) {
      this.initDatePicker();
    }
    this.checkMagicLinkSignIn();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('click', this.closeDropdownsOutside);
  },
  unmounted() {
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('click', this.closeDropdownsOutside);
  },
  watch: {
    viewMode() {
      this.computeTopRow();
    }
  },
  updated() {
    if (this.shouldScrollToResults && !this.isLoading) {
      this.scrollToResults();
      this.shouldScrollToResults = false;
    }
  },
  computed: {
    paginationPages() {
      const total = this.totalPages;
      const current = this.currentPage;
      if (total <= 6) {
        return Array.from({ length: total }, (_, i) => i + 1);
      }
      if (current <= 3) return [1, 2, 3, '…', total];
      if (current >= total - 2) return [1, '…', total - 2, total - 1, total];
      return [1, '…', current, '…', total];
    }
  },
  methods: {
    async precacheAllItems() {
      try {
        const snapshot = await db.collection('items').where('status', '==', 'available').get();
        this.itemCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {

      }
    },
    scrollToResults() {
      const target = document.querySelector('.ai-loader-section') || document.querySelector('.search-results');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    loadUserProfile() {
      if (!this.user) return;
      db.collection('users').doc(this.user.uid).get().then(doc => {
        if (doc.exists) {
          const data = doc.data();
          this.userProfile = {
            displayName: data.displayName || this.user.displayName || '',
            email: this.user.email
          };
        } else {
          this.userProfile = {
            displayName: this.user.displayName || '',
            email: this.user.email
          };
          db.collection('users').doc(this.user.uid).set({
            displayName: this.userProfile.displayName,
            email: this.userProfile.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }).catch(error => {

      });
    },
    initDatePicker() {
      setTimeout(() => {
        if (this.$refs.datePicker) {
          flatpickr(this.$refs.datePicker, {
            dateFormat: 'Y-m-d',
            maxDate: 'today',
            onChange: (selectedDates) => {
              if (selectedDates.length > 0) {
                const selectedDate = selectedDates[0];
                const fromDate = new Date(selectedDate);
                fromDate.setDate(fromDate.getDate() - 7);
                const toDate = new Date(selectedDate);
                toDate.setDate(toDate.getDate() + 7);
                this.searchDateRange.from = this.formatDateYMD(fromDate);
                this.searchDateRange.to = this.formatDateYMD(toDate);
                this.selectedDate = this.formatDateYMD(selectedDate);
              } else {
                this.searchDateRange.from = '';
                this.searchDateRange.to = '';
                this.selectedDate = '';
              }
            }
          });
        }
      }, 100);
    },
    formatDateYMD(date) {
      return date.toISOString().split('T')[0];
    },
    sendMagicLink() {
      if (!this.magicLinkEmail) {
        this.authError = "Please enter your email address";
        return;
      }
      this.magicLinkSending = true;
      this.authError = null;
      const actionCodeSettings = { url: window.location.href, handleCodeInApp: true };
      firebase.auth().sendSignInLinkToEmail(this.magicLinkEmail, actionCodeSettings).then(() => {
        window.localStorage.setItem('emailForSignIn', this.magicLinkEmail);
        this.magicLinkSent = true;
      }).catch(error => {
        this.authError = error.message;
      }).finally(() => {
        this.magicLinkSending = false;
      });
    },
    signInWithGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider).then(() => {
        this.showLoginModal = false;
      }).catch(error => {
        this.authError = error.message;
      });
    },
    checkMagicLinkSignIn() {
      if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
          email = window.prompt('Please provide your email for confirmation');
        }
        if (email) {
          this.isLoading = true;
          firebase.auth().signInWithEmailLink(email, window.location.href).then(() => {
            window.localStorage.removeItem('emailForSignIn');
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }).catch(() => {
            this.showMessage('Sign-in failed', 'Something went wrong while signing you in. Please try again.');
          }).finally(() => {
            this.isLoading = false;
          });
        }
      }
    },
    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
    },
    buildSearchParams() {
      return {
        query: this.searchQuery,
        itemType: this.selectedItemType === 'Others' ? this.otherItemType : this.selectedItemType,
        location: this.selectedLocation,
        dateRange: this.searchDateRange
      };
    },
    hasSearchCriteria() {
      const params = this.buildSearchParams();
      const hasDate = !!(params.dateRange && (params.dateRange.from || params.dateRange.to));
      return !!(
        (params.query && params.query.trim()) ||
        (params.itemType && params.itemType.trim()) ||
        params.location ||
        hasDate
      );
    },
    async performSearch() {
      if (!this.user) {
        this.showLoginModal = true;
        return;
      }
      if (!this.hasSearchCriteria()) {
        this.searchError = 'Enter what you lost — a name, type, location, or date — to search.';
        return;
      }
      this.searchError = '';
      const searchParams = this.buildSearchParams();
      this.lastSearchParams = searchParams;
      this.searchPerformed = true;
      this.currentPage = 1;

      const useAI = this.isComplexSearch(searchParams);
      this.aiAssisted = useAI;

      if (!useAI) {
        this.topMatchIds = [];
        this.updatePagination(this.performBasicSearch(searchParams));
        this.triggerResultsEntrance();
        this.shouldScrollToResults = true;
        return;
      }

      this.aiCancelled = false;
      this.aiSearching = true;
      this.searchResults = [];
      this.allItems = [];
      this.shouldScrollToResults = true;

      const results = await this.performAISearch(searchParams);

      if (this.aiCancelled) return;

      this.updatePagination(results);
      this.aiSearching = false;
      this.$nextTick(() => {
        this.triggerResultsEntrance();
        this.computeTopRow();
      });
    },
    tryNormalSearch() {
      this.aiCancelled = true;
      this.aiSearching = false;
      this.aiAssisted = false;
      this.topMatchIds = [];
      const params = this.lastSearchParams || this.buildSearchParams();
      this.updatePagination(this.performBasicSearch(params));
      this.$nextTick(() => this.triggerResultsEntrance());
    },
    entranceStyle(idx) {
      const col = idx % this.gridCols;
      const fromLeft = col < this.gridCols / 2;
      return {
        '--enter-dir': fromLeft ? -1 : 1,
        '--enter-delay': (idx % this.itemsPerPage) * 0.05 + 's'
      };
    },
    measureGridCols() {
      const container = document.querySelector(this.viewMode === 'grid' ? '.results-grid' : '.results-list');
      if (!container || !container.children.length) {
        this.gridCols = 1;
        return;
      }
      const cards = Array.from(container.children);
      const firstTop = cards[0].offsetTop;
      this.gridCols = cards.filter(c => Math.abs(c.offsetTop - firstTop) < 4).length || 1;
    },
    computeTopRow() {
      this.topMatchIds = [];
      if (!this.aiAssisted || this.currentPage !== 1 || this.sortOption !== 'relevance' || !this.searchResults.length) {
        return;
      }
      this.$nextTick(() => {
        if (!this.aiAssisted || this.currentPage !== 1 || this.sortOption !== 'relevance') return;
        const container = document.querySelector(this.viewMode === 'grid' ? '.results-grid' : '.results-list');
        if (!container || !container.children.length) return;
        const cards = Array.from(container.children);
        const firstTop = cards[0].offsetTop;
        const rowCount = cards.filter(c => Math.abs(c.offsetTop - firstTop) < 4).length;
        this.topMatchIds = this.searchResults.slice(0, rowCount).map(item => item.id);
      });
    },
    onResize() {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.computeTopRow(), 150);
    },
    triggerResultsEntrance() {
      this.resultsAnimating = false;
      this.$nextTick(() => {
        this.measureGridCols();
        requestAnimationFrame(() => { this.resultsAnimating = true; });
        setTimeout(() => { this.resultsAnimating = false; }, 1500);
      });
    },
    isComplexSearch(params) {
      return params.query && params.query.trim().length > 0;
    },
    performBasicSearch(params) {
      this.aiRankedIds = [];
      let filtered = this.itemCache.filter(item => {
        const inDate = this.isInDateRange(item.dateFound, params.dateRange);
        const inLocation = !params.location || item.location === params.location;
        const inType = !params.itemType || (item.category && item.category.toLowerCase() === params.itemType.toLowerCase());
        return inDate && inLocation && inType;
      });

      if (params.query) {
        filtered = this.fallbackSearch(params, filtered);
      }

      return this.sortResults(filtered, params);
    },
    async aiFetchWithRetry(prompt, maxRetries = 1) {
      const doFetch = () => requestAIChat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      });

      let response = await doFetch();
      for (let attempt = 0; attempt < maxRetries && response.status === 429 && !this.aiCancelled; attempt++) {
        const retryAfter = parseFloat(response.headers.get('retry-after'));
        const waitMs = Math.min(isNaN(retryAfter) ? 1200 : retryAfter * 1000, 3000);
        console.info(`[Reunited] AI rate-limited (429); retrying in ${waitMs}ms…`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        if (this.aiCancelled) break;
        response = await doFetch();
      }
      return response;
    },
    async performAISearch(params) {
      this.aiRankedIds = [];
      const prefilteredItems = this.prefilterItemsForAI(params, this.itemCache);

      if (prefilteredItems.length === 0) {
        return [];
      }

      try {
        const prompt = this.buildAIPrompt(params, prefilteredItems);
        const response = await this.aiFetchWithRetry(prompt);

        if (!response.ok) throw new Error(`AI search failed: ${response.status}`);

        const data = await response.json();
        const aiResponse = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
        const itemIds = this.extractItemIds(aiResponse);

        if (itemIds.length === 0) {
          console.warn('[Reunited] AI returned no usable item IDs; using keyword fallback.');
          return this.sortResults(this.fallbackSearch(params, prefilteredItems), params);
        }

        const itemsMap = new Map(prefilteredItems.map(item => [item.id, item]));
        const ranked = itemIds.map(id => itemsMap.get(id)).filter(Boolean);

        if (ranked.length === 0) {
          return this.sortResults(this.fallbackSearch(params, prefilteredItems), params);
        }

        this.aiRankedIds = ranked.map(item => item.id);
        console.info(`[Reunited] AI ranked ${ranked.length} of ${prefilteredItems.length} candidates.`);
        return this.applyResultSort(ranked, params);
      } catch (error) {
        console.warn('[Reunited] AI ranking failed; using keyword fallback:', error);
        return this.sortResults(this.fallbackSearch(params, prefilteredItems), params);
      }
    },
    applyResultSort(items, params) {
      if (this.sortOption === 'date-desc' || this.sortOption === 'date-asc') {
        return this.sortResults(items, params);
      }
      return items;
    },
    prefilterItemsForAI(params, items) {
      const pool = items.filter(item => {
        const inDate = this.isInDateRange(item.dateFound, params.dateRange);
        const inLocation = !params.location || item.location === params.location;
        const inType = !params.itemType || (item.category && item.category.toLowerCase() === params.itemType.toLowerCase());
        return inDate && inLocation && inType;
      });

      const searchTerms = this.generateSearchTerms(params.query);
      if (searchTerms.length === 0) return pool.slice(0, 60);

      let candidates = pool.filter(item =>
        item.searchTerms && item.searchTerms.some(term => searchTerms.includes(term))
      );
      if (candidates.length === 0) {
        const q = params.query.toLowerCase();
        candidates = pool.filter(item =>
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q))
        );
      }
      if (candidates.length === 0) candidates = pool;
      return candidates.slice(0, 60);
    },
    buildAIPrompt(params, items) {
      let prompt = `You are a search relevance API for a lost-and-found service. Return ONLY the item IDs that genuinely match the user's query, ordered most relevant first.
HOW TO MATCH: Judge primarily by the item NAME (what kind of object it is), then the description and category. Note the object TYPE and its COLOUR. EXCLUDE any item that is a different kind of object from what the user asked for — e.g. never return a t-shirt or jacket when the user searches for a "water bottle". A colour mismatch is acceptable if the object type matches, but a wrong object type is not.
CRITICAL OUTPUT RULE: Your entire response MUST be a single line of text containing a comma-separated list of matching item IDs. DO NOT include any other text, explanations, or markdown like \`\`\`. If nothing matches, return an empty line.
Correct Output Example: idAbc123,idXyz789,idPqr456

Search Query: "${params.query}"
---
Available Items to Rank:
`;
      items.forEach(item => {
        prompt += `ID: ${item.id}, Name: ${item.name}, Description: ${item.description}, Category: ${item.category}\n`;
      });
      return prompt;
    },
    extractItemIds(aiResponse) {
      if (!aiResponse) return [];
      let content = aiResponse;

      const thinkEndTag = "</think>";
      const thinkEndIndex = content.lastIndexOf(thinkEndTag);
      if (thinkEndIndex !== -1) {
        content = content.substring(thinkEndIndex + thinkEndTag.length);
      }

      const cleanedResponse = content.replace(/[^a-zA-Z0-9,-]/g, '');

      return cleanedResponse.split(',')
        .map(id => id.trim())
        .filter(id => id.length > 5);
    },
    fallbackSearch(params, allItems) {
      const query = params.query.toLowerCase();
      return allItems.filter(item => {
        const inName = item.name && item.name.toLowerCase().includes(query);
        const inDesc = item.description && item.description.toLowerCase().includes(query);
        const inType = !params.itemType || (item.category && item.category.toLowerCase() === params.itemType.toLowerCase());
        const inLocation = !params.location || item.location === params.location;
        const inDate = this.isInDateRange(item.dateFound, params.dateRange);
        return (inName || inDesc) && inType && inLocation && inDate;
      });
    },
    isInDateRange(dateValue, dateRange) {
      if (!dateRange.from && !dateRange.to) return true;
      if (!dateValue) return false;
      const itemDate = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(itemDate.getTime())) return false;
      if (dateRange.from && itemDate < new Date(dateRange.from)) return false;
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) return false;
      }
      return true;
    },
    generateSearchTerms(query) {
      return [...new Set(query.toLowerCase().split(/\s+/).filter(term => term.length > 2))];
    },
    updatePagination(results) {
      this.allItems = results;
      this.totalPages = Math.ceil(this.allItems.length / this.itemsPerPage);
      this.currentPage = 1;
      this.searchResults = this.allItems.slice(0, this.itemsPerPage);
      this.computeTopRow();
    },
    sortResults(items = null, params = null) {
      const toSort = items || [...this.allItems];
      const currentParams = params || { query: this.searchQuery, itemType: this.selectedItemType };

      switch (this.sortOption) {
        case 'date-desc':
          toSort.sort((a, b) => (b.dateFound && b.dateFound.toDate ? b.dateFound.toDate() : 0) - (a.dateFound && a.dateFound.toDate ? a.dateFound.toDate() : 0));
          break;
        case 'date-asc':
          toSort.sort((a, b) => (a.dateFound && a.dateFound.toDate ? a.dateFound.toDate() : 0) - (b.dateFound && b.dateFound.toDate ? b.dateFound.toDate() : 0));
          break;
        case 'relevance':
          if (this.aiRankedIds && this.aiRankedIds.length) {
            const order = new Map(this.aiRankedIds.map((id, i) => [id, i]));
            toSort.sort((a, b) =>
              (order.has(a.id) ? order.get(a.id) : Infinity) - (order.has(b.id) ? order.get(b.id) : Infinity)
            );
          } else if (currentParams.query) {
            const query = currentParams.query.toLowerCase();
            toSort.sort((a, b) => this.calculateRelevanceScore(b, query, currentParams.itemType) - this.calculateRelevanceScore(a, query, currentParams.itemType));
          }
          break;
      }
      return toSort;
    },
    calculateRelevanceScore(item, query, preferredType) {
      let score = 0;
      if (item.name && item.name.toLowerCase().includes(query)) score += 10;
      if (item.description && item.description.toLowerCase().includes(query)) score += 3;
      if (preferredType && item.category && item.category.toLowerCase() === preferredType.toLowerCase()) {
        score += 20;
      }
      return score;
    },
    resetFilters() {
      this.searchQuery = '';
      this.selectedItemType = '';
      this.otherItemType = '';
      this.selectedLocation = '';
      this.selectedDate = '';
      this.searchDateRange = { from: '', to: '' };
      if (this.$refs.datePicker && this.$refs.datePicker._flatpickr) {
        this.$refs.datePicker._flatpickr.clear();
      }
      this.aiAssisted = false;
      this.aiSearching = false;
      this.aiCancelled = true;
      this.searchError = '';
      this.searchResults = [];
      this.allItems = [];
      this.searchPerformed = false;
    },
    selectOption(key, value, event) {
      this[key] = value;
      this.searchError = '';
      const dropdown = event.target.closest('details');
      if (dropdown) dropdown.open = false;
    },
    closeDropdownsOutside(event) {
      document.querySelectorAll('details.custom-select[open]').forEach(dropdown => {
        if (!dropdown.contains(event.target)) dropdown.open = false;
      });
      if (!event.target.closest('.nav-account')) {
        this.accountMenuOpen = false;
      }
    },
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        this.searchResults = this.allItems.slice(startIndex, startIndex + this.itemsPerPage);
        this.computeTopRow();
      }
    },
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        this.searchResults = this.allItems.slice(startIndex, startIndex + this.itemsPerPage);
        this.computeTopRow();
      }
    },
    goToPage(page) {
      if (page === '…' || page === this.currentPage) return;
      this.currentPage = page;
      const startIndex = (page - 1) * this.itemsPerPage;
      this.searchResults = this.allItems.slice(startIndex, startIndex + this.itemsPerPage);
      this.computeTopRow();
    },
    formatTimeAgo(dateValue) {
      if (!dateValue) return 'recently';
      const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(date.getTime())) return 'recently';
      const days = Math.floor((Date.now() - date.getTime()) / 86400000);
      if (days <= 0) return 'today';
      if (days === 1) return '1 day ago';
      if (days < 7) return `${days} days ago`;
      const weeks = Math.floor(days / 7);
      if (weeks === 1) return '1 week ago';
      if (weeks < 5) return `${weeks} weeks ago`;
      const months = Math.floor(days / 30);
      if (months <= 1) return '1 month ago';
      return `${months} months ago`;
    },
    showMessage(title, text, action = null) {
      this.messageModal = {
        visible: true,
        title,
        text,
        actionLabel: action ? action.label : '',
        actionHref: action ? action.href : ''
      };
    },
    closeMessageModal() {
      this.messageModal.visible = false;
    },
    openItemDetails(item) {
      this.selectedItem = { ...item };
      this.itemValuation = null;
      if (!item.claimed && this.user) {
        this.getItemValuation(item);
      }
      if (item.hasAdditionalImages) {
        this.loadAdditionalImages(item.id);
      }
    },
    loadAdditionalImages(itemId) {
      const imagesRef = storage.ref(`items/${itemId}/images`);
      imagesRef.listAll().then(result => {
        return Promise.all(result.items.map(ref => ref.getDownloadURL()));
      }).then(urls => {
        if (urls.length > 0) {
          this.selectedItem.additionalImages = urls;
        }
      }).catch(error => { });
    },
    async getItemValuation(item) {
      try {
        const response = await requestAIChat({
          messages: [{
            role: 'user',
            content: `Estimate the value of this item in INR. Return only a numeric value or range with the currency symbol, e.g., "₹2000" or "₹8000-12000". No explanation. Item: ${item.name}, Description: ${item.description}`
          }],
          temperature: 0.3
        });
        if (!response.ok) throw new Error('AI valuation failed');
        const data = await response.json();
        const content = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content.trim()) || "N/A";
        this.itemValuation = content;
      } catch (error) {

        this.itemValuation = "₹500-1500";
      }
    },
    initiateClaimItem(item) {
      if (!this.user) {
        this.showLoginModal = true;
        return;
      }
      if (item.claimed) {
        this.showMessage('Already claimed', 'This item has already been claimed by another user.');
        return;
      }
      this.claimItem = item;
      this.claimForm = {
        description: '',
        contactInfo: this.user.phoneNumber || this.user.email || ''
      };
      this.selectedItem = null;
      this.showClaimModal = true;
    },
    async submitClaim() {
      if (!this.user || !this.claimItem) {
        this.showLoginModal = true;
        return;
      }

      const activeClaims = await db.collection('claims')
        .where('userId', '==', this.user.uid)
        .where('status', 'in', ['pending', 'approved'])
        .get();

      if (activeClaims.size >= 3) {
        this.showMessage('Claim limit reached', 'You can have up to 3 active claims at a time. Please wait for your current claims to be resolved.');
        return;
      }

      this.isSubmittingClaim = true;
      try {
        let estimatedValue = 0;
        if (this.itemValuation) {
          const valueMatch = this.itemValuation.match(/₹(\d+)/);
          if (valueMatch && valueMatch[1]) {
            estimatedValue = parseInt(valueMatch[1], 10);
          }
        }

        const isHighValue = estimatedValue >= 5000;
        const claimStatus = isHighValue ? 'pending' : 'approved';

        const pickupDeadline = new Date();
        pickupDeadline.setDate(pickupDeadline.getDate() + 7);

        let claimCode = this.claimItem.claimCode;
        if (!claimCode) {
          claimCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        const claimData = {
          itemId: this.claimItem.id,
          userId: this.user.uid,
          userName: this.user.displayName || this.user.email,
          userEmail: this.user.email,
          claimDate: firebase.firestore.FieldValue.serverTimestamp(),
          description: this.claimForm.description,
          contactInfo: this.claimForm.contactInfo,
          status: claimStatus,
          itemName: this.claimItem.name,
          itemCategory: this.claimItem.category,
          itemLocation: this.claimItem.location,
          estimatedValue: estimatedValue,
          claimCode: claimCode,
          pickupDeadline: firebase.firestore.Timestamp.fromDate(pickupDeadline)
        };

        const claimRef = await db.collection('claims').add(claimData);

        await db.collection('items').doc(this.claimItem.id).update({
          claimed: true,
          claimId: claimRef.id,
          claimStatus: claimStatus,
          claimCode: claimCode
        });

        const claimantFirstName = this.user.displayName ? this.user.displayName.split(' ')[0] : 'User';
        await db.collection('log').add({
          itemName: this.claimItem.name,
          claimDate: firebase.firestore.FieldValue.serverTimestamp(),
          claimantFirstName: claimantFirstName,
          itemId: this.claimItem.id,
          claimId: claimRef.id
        });

        await db.collection('notifications').add({
          userId: this.user.uid,
          title: isHighValue ? 'Claim Submitted for Review' : 'Item Claimed Successfully',
          message: isHighValue
            ? `Your claim for ${this.claimItem.name} is pending review. Please use the contact form for follow-up. You have 7 school days to collect once approved.`
            : `Your claim for ${this.claimItem.name} has been approved. Use code ${claimCode} to collect your item. You have 7 school days to collect or it will be returned to lost and found.`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          type: 'claim',
          read: false,
          actionable: true,
          itemId: this.claimItem.id,
          claimId: claimRef.id
        });

        if (isHighValue) {
          this.showClaimModal = false;
          const contactUrl = `index.html#contact?claim=${claimRef.id}&item=${encodeURIComponent(this.claimItem.name)}`;
          this.showMessage(
            'Verification needed',
            `This item's estimated value (₹${estimatedValue}) requires a quick verification. Please use the contact form to complete your claim.`,
            { label: 'Continue to contact form', href: contactUrl }
          );
        } else {
          try {
            await fetch('https://api.reunited.co.in/api/send-claim-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: this.user.email,
                userName: this.user.displayName || this.user.email,
                itemName: this.claimItem.name,
                claimCode: claimCode,
                itemLocation: this.claimItem.location,
                claimDate: new Date().toISOString()
              })
            });
          } catch (emailError) {

          }
          this.claimItem.claimCode = claimCode;
          this.showClaimModal = false;
          this.showClaimCodeModal = true;
        }
      } catch (error) {

        this.showMessage('Something went wrong', 'An error occurred while submitting your claim. Please try again.');
      } finally {
        this.isSubmittingClaim = false;
      }
    },
    goToClaimLog() {
      window.location.href = 'dashboard.html#claims';
    },
    disputeClaim(itemId) {
      window.location.href = 'index.html#contact';
    },
    formatDate(dateString) {
      try {
        if (dateString && dateString.toDate) {
          return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(dateString.toDate());
        }
        if (dateString) {
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
          }
        }
        return "No date available";
      } catch (error) {

        return "Date format error";
      }
    },
    formatDateTime(dateString) {
      try {
        if (dateString && dateString.toDate) {
          return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(dateString.toDate());
        }
        if (dateString) {
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(date);
          }
        }
        return "No date available";
      } catch (error) {

        return "Date format error";
      }
    },
    truncateDescription(text, maxLength = 100) {
      if (!text || text.length <= maxLength) return text || '';
      return text.substring(0, maxLength) + '...';
    },
    getProfileInitials(displayName) {
      if (!displayName || displayName.trim().length === 0) {
        return this.user?.email?.charAt(0).toUpperCase() || '?';
      }
      const names = displayName.trim().split(' ');
      if (names.length === 1) {
        return names[0].charAt(0).toUpperCase();
      }
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    },
    getProfilePictureColor(displayName) {
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
        '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
        '#10AC84', '#EE5A24', '#0984E3', '#A29BFE', '#FD79A8'
      ];
      const name = displayName || this.user?.email || '';
      const charSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      return colors[charSum % colors.length];
    },
    signOut() {
      firebase.auth().signOut().catch(() => { });
    }
  }
});

app.mount('#searchApp');