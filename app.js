// =================================================================
// ===== COMPLETE DATACITE JAVASCRIPT CLASS (v2.0 - Unified) =====
// =================================================================
class DataCite {
    constructor({ apiBaseUrl, repositoryId = null, password = null }) {
        this.apiBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
        this.repositoryId = repositoryId;
        this.password = password;
        this.availablePrefixes = [];
        this.clientName = "";
        this._authenticated = false;
    }

    // --- Core API Request Method ---
    _makeRequest(method, urlPath, { params = null, payload = null, headers = {} } = {}) {
        return new Promise((resolve, reject) => {
            const requestUrl = urlPath.startsWith('http') ? urlPath : this.apiBaseUrl + urlPath;
            let finalHeaders = { ...headers };
            let expectJson = true;

            if (!headers['Accept']) {
                finalHeaders['Accept'] = 'application/vnd.api+json';
            } else if (!headers['Accept'].endsWith('+json')) {
                expectJson = false;
            }

            const ajaxSettings = {
                url: requestUrl, type: method, headers: finalHeaders,
                success: (data, textStatus, jqXHR) => resolve(jqXHR.status === 204 ? null : (expectJson ? data : jqXHR.responseText)),
                error: (jqXHR, textStatus, errorThrown) => {
                    const error = new Error(jqXHR.responseJSON?.errors?.[0]?.title || errorThrown || "API Error");
                    error.status = jqXHR.status;
                    error.response = jqXHR.responseJSON;
                    reject(error);
                }
            };

            if (this.repositoryId && this.password) {
                ajaxSettings.beforeSend = (xhr) => xhr.setRequestHeader("Authorization", "Basic " + btoa(this.repositoryId + ":" + this.password));
            }
            if (payload) {
                ajaxSettings.data = JSON.stringify(payload);
                ajaxSettings.contentType = 'application/vnd.api+json;charset=UTF-8';
            }
            if (params && method === 'GET') { ajaxSettings.data = params; }
            $.ajax(ajaxSettings);
        });
    }

    _ensureAuthenticated() { if (!this._authenticated) throw new Error("Authentication required."); }

    // --- User and DOI Management Methods ---
    async _login() {
        if (!this.password || !this.repositoryId) {
            console.warn("Cannot fetch accessible identifiers: Client not authenticated or repositoryId missing.");
            this._authenticated = false; this.availablePrefixes = []; return;
        }
        try {
            const response = await this._makeRequest("GET", `/clients/${this.repositoryId}`);
            if (response && response.data) {
                if (!response.data.attributes.hasPassword) {
                    this._authenticated = false;
                    return;
                }
                this._authenticated = true;
                this.clientName = response.data.attributes.name;
                this.availablePrefixes = [];
                if (response.data.relationships?.prefixes?.data?.length) { this.availablePrefixes = response.data.relationships.prefixes.data.filter(p => p.id).map(p => p.id); }
            } else { this.availablePrefixes = []; this._authenticated = false;}
        } catch (error) {
            console.error(`Failed to fetch identifiers for ${this.repositoryId}:`, error.textStatus || error.message);
            this.availablePrefixes = []; this._authenticated = false;
        }
    }

    getDoi(doiId, representation = 'json_full_data') {
        const headers = {};
        if (representation === 'xml') { headers['Accept'] = 'application/vnd.datacite.datacite+xml'; }
        else if (representation === 'json_full_data') { headers['Accept'] = 'application/vnd.api+json'; }
        else if (representation === 'json_attributes') { headers['Accept'] = 'application/vnd.datacite.datacite+json'; }
        return this._makeRequest("GET", `/dois/${encodeURIComponent(doiId)}`, { headers: headers });
    }

    async* getDoisGenerator({ prefix = null, query = null, fields = null }) {
        let params = { 'page[size]': 100 };
        if (prefix) params.prefix = prefix;
        if (query) params.query = query;
        if (fields) params['fields[dois]'] = fields;

        let nextPageUrl = "/dois";
        let isFirstRequest = true;

        while(nextPageUrl) {
            const response = await this._makeRequest("GET", nextPageUrl, { params: isFirstRequest ? params : null });
            isFirstRequest = false;
            if (!response?.data?.length) break;
            for(const item of response.data) yield item;
            const nextLinkFull = response.links?.next;
            nextPageUrl = nextLinkFull ? new URL(nextLinkFull).pathname + new URL(nextLinkFull).search : null;
        }
    }

    addDoi(attributes) { return this._makeRequest("POST", "/dois", { payload: { data: { type: "dois", attributes } } }); }
    updateDoiAttributes(doiId, attributes) { return this._makeRequest("PUT", `/dois/${encodeURIComponent(doiId)}`, { payload: { data: { type: "dois", id: doiId, attributes } } }); }
    updateDoiStatus(doiId, event) { return this.updateDoiAttributes(doiId, { event: event }); }
    deleteDoi(doiId) { return this._makeRequest("DELETE", `/dois/${encodeURIComponent(doiId)}`); }
    /** Determines if DOI exists (for POST/PUT decision). @private @async */
    async _determineUpsertAction(doiId) {
        if (!doiId) return "POST";
        try {
            await this.getDoi(doiId);
            return "PUT";
        } catch (error) {
            if (error.status === 404) {
                return "POST";
            } else {
                // Re-throw other errors (e.g., auth errors, server errors)
                throw error;
            }
        }
    }
    // --- Batch Upload Logic ---
    async uploadDoiFromXml(doi, xmlString, event = null) {
        const base64Xml = btoa(unescape(encodeURIComponent(xmlString)));
        const attributes = { xml: base64Xml };
        if (event) attributes.event = event;
        attributes.doi = doi;
        try {
            const action = await this._determineUpsertAction(doi);
            if (action === "PUT") {
                await this.updateDoiAttributes(doi, attributes);
                return "Updated";
            } else {
                attributes.prefix = doi.split('/')[0];
                await this.addDoi(attributes);
                return "Created";
            }
        } catch (e) { throw e;  }
    }
    updateDoiWithXml(doi, xmlString, event = null) {
        const base64Xml = btoa(unescape(encodeURIComponent(xmlString)));
        const attributes = { xml: base64Xml };
        if (event) attributes.event = event;
        attributes.doi = doi;
        attributes.prefix = doi.split('/')[0];
        return this.updateDoiAttributes(doi, attributes);
    }

    async uploadDoisFromFiles({ fileList, statusCallback, event = null }) {
        this._ensureAuthenticated();
        statusCallback(`Starting upload of ${fileList.length} file(s). Applying event: ${event || 'None'}\n\n`, 'info');
        const results = [];
        for (const file of fileList) {
            statusCallback(`Processing: ${file.name}...`, 'secondary');
            try {
                const content = await this._readFileAsText(file);
                if (file.name.toLowerCase().endsWith('.json')) {
                    const attributes = JSON.parse(content);
                    const doi = attributes.doi;
                    if (!doi) throw new Error("JSON file is missing a 'doi' field.");
                    // Add the event to the attributes if selected by the user
                    if (event) attributes.event = event;
                    statusCallback(` -> Found DOI ${doi}. Checking existence...`, 'secondary');
                    try {
                        const action = await this._determineUpsertAction(doi);
                        statusCallback(action === "PUT" ? ' -> Exists. Updating...' : ' -> New. Creating...', 'info');
                        if (action === "PUT") {
                            await this.updateDoiAttributes(doi, attributes);
                            statusCallback(` -> SUCCESS: Updated ${doi}.\n`, 'success');
                            results.push({ doi: doi, status: 'Updated' });
                        } else {
                            await this.addDoi(attributes);
                            statusCallback(` -> SUCCESS: Created ${doi}.\n`, 'success');
                            results.push({ doi: doi, status: 'Created' });
                        }
                    } catch (e) {
                        throw e;
                    }
                } else if (file.name.toLowerCase().endsWith('.xml')) {
                    const doiMatch = content.match(/<identifier identifierType="DOI">(.*?)<\/identifier>/);
                    if (!doiMatch || !doiMatch[1]) throw new Error("Could not find a DOI identifier in the XML file.");
                    const doi = doiMatch[1].trim();
                    statusCallback(` -> Found DOI ${doi}. Checking existence for create/update...`, 'secondary');
                    const status = await this.uploadDoiFromXml(doi, content, event);
                    statusCallback(` -> SUCCESS: ${status} ${doi}.\n`, 'success');
                    results.push({ doi: doi, status: status });
                } else {
                    statusCallback(` -> SKIPPED: Unsupported file type.\n`, 'warning');
                }
            } catch (error) {
                statusCallback(` -> FAILED: ${error.message}\n`, 'danger');
                console.error(`Error processing ${file.name}:`, error);
            }
        }
        statusCallback("\n--- Batch Upload Finished ---\n", 'info');
        return results;
    }

    _readFileAsText(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = e => resolve(e.target.result); reader.onerror = e => reject(e); reader.readAsText(file); }); }

    /**
     * Recursively checks if a condition is met within a nested data structure.
     * This helper is used by the main update logic.
     * @private
     * @param {object|Array} currentLevel - The object or array to search within.
     * @param {string[]} pathParts - The remaining parts of the path to traverse.
     * @param {string} pattern - The regex pattern to search for.
     * @returns {boolean} - True if the pattern is found in any value at the specified path.
     */
    _checkConditionByPath(currentLevel, pathParts, pattern) {
        if (!pathParts?.length || currentLevel === null || currentLevel === undefined) return false;
        const key = pathParts[0];
        const remainingPath = pathParts.slice(1);
        if (key === "[]") {
            // If any item in the list meets the condition, the overall condition is true for this path.
            return Array.isArray(currentLevel) && currentLevel.some(item => this._checkConditionByPath(item, remainingPath, pattern));
        }
        if (typeof currentLevel !== 'object' || !currentLevel.hasOwnProperty(key)) return false;
        if (remainingPath.length === 0) {
            // Reached the target value, test the pattern.
            return new RegExp(pattern).test(String(currentLevel[key]));
        }
        // Recurse deeper into the object.
        return this._checkConditionByPath(currentLevel[key], remainingPath, pattern);
    }

    /**
     * Recursively finds and extracts values based on a path and regex pattern.
     * This is used for the "Extract & Set" operation mode.
     * @private
     * @param {object|Array} currentLevel - The object or array to search within.
     * @param {string[]} pathParts - The remaining parts of the path.
     * @param {string} pattern - The regex pattern, potentially with a capturing group.
     * @returns {string[]} - A list of all extracted strings that matched the pattern.
     */
    _findAndExtractValuesByPath(currentLevel, pathParts, pattern) {
        if (!pathParts?.length || currentLevel === null || currentLevel === undefined) return [];
        const key = pathParts[0];
        const remainingPath = pathParts.slice(1);
        let foundValues = [];

        if (key === "[]") {
            if (Array.isArray(currentLevel)) {
                currentLevel.forEach(item => {
                    foundValues.push(...this._findAndExtractValuesByPath(item, remainingPath, pattern));
                });
            }
            return foundValues;
        }
        if (typeof currentLevel === 'object' && currentLevel.hasOwnProperty(key)) {
            if (remainingPath.length === 0) {
                const valueStr = String(currentLevel[key]);
                const regex = new RegExp(pattern);
                const match = valueStr.match(regex);
                if (match) {
                    // Prioritize the first capturing group if it exists, otherwise use the full match.
                    return [match[1] || match[0]];
                }
                return [];
            } else {
                return this._findAndExtractValuesByPath(currentLevel[key], remainingPath, pattern);
            }
        }
        return [];
    }

    /**
     * Recursively updates a value in a nested structure, creating parts of the path if they don't exist.
     * @private
     * @param {object|Array} currentLevel - The object or array to modify.
     * @param {string[]} pathParts - The remaining path parts to traverse.
     * @param {string|null} pattern - The regex pattern to apply for substitution. If null, a direct replacement is performed.
     * @param {*} replacement - The new value or replacement string.
     * @returns {boolean} - True if a change was made.
     */
    _updateValueByPathRecursive(currentLevel, pathParts, pattern, replacement) {
        if (!pathParts?.length) return false;
        const key = pathParts[0];
        const remainingPath = pathParts.slice(1);
        if (key === "[]") {
            let anyChange = false;
            if (Array.isArray(currentLevel)) {
                currentLevel.forEach(item => {
                    if (this._updateValueByPathRecursive(item, remainingPath, pattern, replacement)) {
                        anyChange = true;
                    }
                });
            }
            return anyChange;
        }
        if (typeof currentLevel !== 'object' || currentLevel === null) return false;

        if (remainingPath.length > 0) {
            const nextIsArray = remainingPath[0] === '[]';
            // Create the next level if it doesn't exist.
            if (!currentLevel.hasOwnProperty(key) || (nextIsArray && !Array.isArray(currentLevel[key])) || (!nextIsArray && (typeof currentLevel[key] !== 'object' || currentLevel[key] === null))) {
                currentLevel[key] = nextIsArray ? [] : {};
            }
            return this._updateValueByPathRecursive(currentLevel[key], remainingPath, pattern, replacement);
        } else {
            // Exceptional case: state
            if (["state","event"].includes(key.toLowerCase())) {
                const originalState = currentLevel["state"];
                const newState = this._mapStatus(replacement);
                if (newState && newState !== this._mapStatus(originalState) && originalState === pattern.toLowerCase()) {
                    //delete currentLevel["state"];
                    if (originalState === "findable") {
                        currentLevel["event"] = "hide";
                    } else {
                        currentLevel["event"] = newState;
                    }
                    return true;
                } else {
                    return false;
                }
            }
            // This is the final key to be modified.
            const originalValue = currentLevel[key];
            let newValue = originalValue;
            if (pattern && typeof originalValue === 'string') {
                newValue = originalValue.replace(new RegExp(pattern, 'g'), replacement);
            } else if (pattern === null) { // Explicitly check for null for direct replacement
                newValue = replacement;
            }
            // Use JSON.stringify for a reliable deep comparison of objects/arrays.
            if (JSON.stringify(newValue) !== JSON.stringify(originalValue)) {
                currentLevel[key] = newValue;
                return true;
            }
            return false;
        }
    }

    _mapStatus(status) {
        // Normalize input and define valid statuses
        var normalized = status.toLowerCase().trim();
        var validStatuses = ["publish", "register", "hide"];

        // Return status if already valid, otherwise map it
        return validStatuses.includes(normalized)
            ? normalized
            : {
            "findable": "publish",
            "registered": "register",
            "draft": "hide"
        }[normalized] || null;
    }

    /**
     * The core of the corrected logic. This recursive function traverses the attribute and condition paths in parallel.
     * It ensures that a condition check and an update action are performed within the same list item context.
     * @private
     * @param {object|Array} currentLevel - The current object/array being processed.
     * @param {object} op - The full update operation definition.
     * @returns {boolean} - True if any change was successfully applied.
     */
    _applyUpdatesRecursively(currentLevel, op) {
        const attrPath = op.attribute || "";
        const condPath = op.condition_attribute;

        // Find the first list iterator '[]' in both paths to determine the common context.
        const attrListIndex = attrPath.indexOf('[]');
        const condListIndex = condPath ? condPath.indexOf('[]') : -1;

        // This is a context-aware update if both paths contain a list iterator at the same base level.
        if (condPath && attrListIndex !== -1 && attrListIndex === condListIndex && attrPath.substring(0, attrListIndex) === condPath.substring(0, condListIndex)) {
            const basePath = attrPath.substring(0, attrListIndex);
            const remainingAttrPath = attrPath.substring(attrListIndex + 2).replace(/^\./, '');
            const remainingCondPath = condPath.substring(condListIndex + 2).replace(/^\./, '');

            let listToIterate = currentLevel;
            if (basePath) { // Navigate to the list if it's nested
                for (const key of basePath.split('.')) {
                    if (typeof listToIterate === 'object' && listToIterate !== null && listToIterate.hasOwnProperty(key)) {
                        listToIterate = listToIterate[key];
                    } else { return false; } // Path to list does not exist
                }
            }

            if (!Array.isArray(listToIterate)) return false;

            let anyChangeMadeInList = false;
            // Iterate over each item in the list. This is the crucial step.
            for (const item of listToIterate) {
                // For each item, we create a sub-operation with paths relative to this item.
                const subOp = { ...op };
                subOp.attribute = remainingAttrPath;
                subOp.condition_attribute = remainingCondPath;

                // Recursively call on the item. The sub-operation will now be evaluated on this item.
                if (this._applyUpdatesRecursively(item, subOp)) {
                    anyChangeMadeInList = true;
                }
            }
            return anyChangeMadeInList;
        }

        // --- Base case or non-contextual update logic ---

        let conditionMet = true; // Default to true if no condition is specified
        if (condPath && op.condition_pattern) {
            const condPathParts = condPath.replace(/\[\]/g, ".[]").split('.');
            conditionMet = this._checkConditionByPath(currentLevel, condPathParts, op.condition_pattern);
        }

        if (!conditionMet) return false; // Condition not met, so no update can happen here

        let valueToSet = op.replacement;
        const isExtractAndSet = condPath && op.condition_pattern && (valueToSet === null || valueToSet === undefined || valueToSet.trim() === '');

        if (isExtractAndSet) {
            const condPathParts = condPath.replace(/\[\]/g, ".[]").split('.');
            const extractedValues = this._findAndExtractValuesByPath(currentLevel, condPathParts, op.condition_pattern);
            if (extractedValues.length === 0) return false;
            valueToSet = extractedValues[0]; // Use the first extracted value
        }

        const updatePathParts = attrPath.replace(/\[\]/g, ".[]").split('.');
        // Use the direct update helper for the final action
        return this._updateValueByPathRecursive(currentLevel, updatePathParts, (isExtractAndSet ? null : op.pattern), valueToSet);
    }


    /**
     * Performs advanced, conditional batch updates on DOIs. This method is memory-efficient and
     * now correctly handles context-aware updates within nested lists.
     * @async
     * @param {object} options - Filtering and update options.
     * @param {Array<object>} options.updates - The list of update operations to perform on each DOI.
     * @param {string|null} options.prefix - A DOI prefix to filter the DOIs that will be updated.
     * @param {string|null} options.query - A text query to filter the DOIs.
     * @param {boolean} options.dryRun - If true, the method will only simulate changes; if false, it will execute them.
     * @param {function} options.statusCallback - A function to report real-time progress and status messages to the UI.
     * @returns {Promise<object>} A promise that resolves to a results object summarizing the operation.
     */
    async batchUpdateAttributesByRegex({ updates, prefix = null, query = null, dryRun = true, statusCallback }) {
        this._ensureAuthenticated();

        statusCallback(`Starting advanced batch update. DRY RUN: ${dryRun}\n`, 'info');
        if (!dryRun) statusCallback("!!! LIVE CHANGES WILL BE WRITTEN !!!\n", 'warning');

        const results = { checked: 0, changedInMemory: 0, updatedOnApi: [], failedOnApi: [], affectedDois: [] };
        const params = { 'page[size]': 50, publisher: true, affiliation: true, detail: true }; // Process in chunks
        if (prefix) params.prefix = prefix;
        if (query) params.query = query;
        if (this.authenticatedClientId) params['client-id'] = this.authenticatedClientId;

        let nextPageUrl = "/dois";
        let isFirstRequest = true;

        while (nextPageUrl) {
            statusCallback(`Fetching page: ${nextPageUrl}...\n`, 'info');
            try {
                const responseData = await this._makeRequest("GET", nextPageUrl, {
                    params: isFirstRequest ? params : null,
                    requiresAuth: this._authenticated // Pass authentication
                });
                isFirstRequest = false;

                if (!responseData?.data?.length) {
                    statusCallback("No more data found.\n", 'info');
                    break;
                }

                for (const doiItem of responseData.data) {
                    results.checked++;
                    const doiId = doiItem.id;
                    statusCallback(`\nChecking DOI: ${doiId}...`, 'secondary');

                    const originalAttributes = doiItem.attributes;
                    const modifiedAttributes = JSON.parse(JSON.stringify(originalAttributes)); // Deep copy
                    let wasChangedForThisDoi = false;

                    for (const op of updates) {
                        // Use the new, corrected recursive helper for each operation.
                        // This single function now handles all direct, conditional, and context-aware logic.
                        if (this._applyUpdatesRecursively(modifiedAttributes, op)) {
                            wasChangedForThisDoi = true;
                        }
                    }

                    if (wasChangedForThisDoi) {
                        results.changedInMemory++;
                        if (dryRun) {
                            results.affectedDois.push(doiId);
                            statusCallback(`  -> [DRY RUN] DOI ${doiId} would be updated.\n`, 'warning');
                        } else {
                            statusCallback(`  -> Updating DOI ${doiId} on API...`, 'info');
                            if (await this.updateDoiAttributes(doiId, modifiedAttributes, 'adv_batch_status')) {
                                results.updatedOnApi.push(doiId);
                                statusCallback(`  -> SUCCESS: Updated ${doiId}.\n`, 'success');
                            } else {
                                results.failedOnApi.push(doiId);
                                statusCallback(`  -> FAILED to update ${doiId}.\n`, 'danger');
                            }
                        }
                    } else {
                        statusCallback(`  -> No changes needed.\n`, 'secondary');
                    }
                }

                nextPageUrl = responseData.links?.next ? new URL(responseData.links.next, this.apiBaseUrl).pathname + new URL(responseData.links.next, this.apiBaseUrl).search : null;

            } catch (error) {
                statusCallback(`\n--- ERROR ---\nAn error occurred while fetching a page: ${error.message}. Aborting.\n`, 'danger');
                console.error(error);
                break;
            }
        }

        statusCallback("\n--- Batch Process Finished ---\n", 'info');
        statusCallback(`DOIs Checked: ${results.checked}\n`, 'info');
        statusCallback(`DOIs Changed (in memory): ${results.changedInMemory}\n`, 'info');
        if (!dryRun) {
            statusCallback(`DOIs Updated on API: ${results.updatedOnApi.length}\n`, 'success');
            statusCallback(`DOIs Failed to Update: ${results.failedOnApi.length}\n`, 'danger');
            if (results.failedOnApi.length > 0) statusCallback(`Failed IDs: ${results.failedOnApi.join(', ')}\n`, 'danger');
        }
        return results;
    }

    // --- ZIP Download Logic ---
    async downloadDoisAsZip({ doiList, outputFormat = 'json_attributes', statusCallback }) {
        const zip = new JSZip();
        statusCallback(`Starting download process for ${doiList.length} DOIs...\n`);
        const fetchJson = outputFormat === 'json_attributes' || outputFormat === 'both';
        const fetchXml = outputFormat === 'xml' || outputFormat === 'both';
        const sanitizedPrefix = this.repositoryId ? this.repositoryId.replace('.', '_') : 'export';
        for (let i = 0; i < doiList.length; i++) {
            const doi = doiList[i];
            const sanitizedDoi = doi.replace(/[^a-zA-Z0-9._-]/g, '_');
            statusCallback(`(${i + 1}/${doiList.length}) Fetching ${doi}...\n`);
            try {
                if (fetchJson) {
                    const data = await this.getDoi(doi, 'json_attributes');
                    zip.file(`${sanitizedPrefix}/json/${sanitizedDoi}.json`, JSON.stringify(data, null, 2));
                }
                if (fetchXml) {
                    const data = await this.getDoi(doi, 'xml');
                    zip.file(`${sanitizedPrefix}/xml/${sanitizedDoi}.xml`, data);
                }
            } catch (error) { statusCallback(`  -> FAILED to fetch ${doi}: ${error.message}\n`); }
        }
        statusCallback('Generating ZIP file...');
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `datacite_export_${sanitizedPrefix}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        statusCallback('\nDownload initiated!');
    }
}

// ===============================================
// ===== JQUERY EVENT HANDLERS AND UI LOGIC ======
// ===============================================
$(document).ready(function() {
    let dataCiteClient = null;
    let mainDataTable = null;
    let uploadResultsTable = null;
    // This variable will hold the DataTable instance for the batch update results.
    let buResultsDataTable;

    // Initialize all Bootstrap components that need it
    const initBootstrapComponents = () => {
        $('[data-bs-toggle="popover"]').each(function() { new bootstrap.Popover(this, { trigger: 'hover', container: 'body' }); });
    };

    // --- Login/Logout and UI State ---
    const updateUIForLoginState = () => {
        const authenticated = dataCiteClient?._authenticated;
        $('#logoutBtn').toggle(authenticated);
        if (authenticated) {
            $('#login-view').hide();
            $('#app-view').show();
            $('#user-info-header').html(`Logged in as: <strong>${dataCiteClient.clientName} (${dataCiteClient.repositoryId})</strong>`);
            populatePrefixDropdowns("filter_prefix_select");
            populatePrefixDropdowns("adv_batch_prefix_select");
            addOperationBlock();
        } else {
            $('#app-view').hide();
            $('#login-view').show();
            $('#user-info-header').text('Not logged in. Using public access.');
        }
    };

    function populatePrefixDropdowns(fieldId) {
        const container = $('label[for='+fieldId+']').parent();
        container.find("#"+fieldId).remove();
        if (dataCiteClient?.availablePrefixes?.length > 0) {
            const prefixSelect = $('<select id="'+fieldId+'" class="form-select"></select>');
            dataCiteClient.availablePrefixes.forEach(prefix => {
                prefixSelect.append(`<option value="${prefix}">${prefix}</option>`);
            });
            container.append(prefixSelect);
        } else {
            container.append('<input type="text" id="'+fieldId+'" class="form-control" placeholder="Prefix">');
        }
    }

    function getDataTableById(tableId) {
        const $table = $('#' + tableId);
        if ($table.length && $.fn.DataTable.isDataTable($table)) { return $table.DataTable(); }
        return null;
    }

    function genStatusIcon(state) {
        if (['findable','publish'].includes(state)) return '<i class="bi bi-check-circle-fill text-success" title="Findable"></i>';
        if (['registered','register'].includes(state)) return '<i class="bi bi-bookmark-check-fill text-secondary" title="Registered"></i>';
        if (['draft','hide'].includes(state)) return '<i class="bi bi-pencil-square text-warning" title="Draft"></i>';
        return state;
    }

    $('#loginBtn').on('click', async function() {
        const btn = $(this);
        const spinner = btn.find('.spinner-border');
        spinner.show();
        btn.prop('disabled', true);
        $('#loginStatus').empty();
        try {
            dataCiteClient = new DataCite({
                apiBaseUrl: $('#api_base').val() || 'https://api.test.datacite.org',
                repositoryId: $('#repositoryId').val().trim(),
                password: $('#password').val()
            });
            await dataCiteClient._login();
            updateUIForLoginState();
        } catch (error) {
            $('#loginStatus').html(`<div class="alert alert-danger">${error.message}</div>`);
            dataCiteClient = null;
        } finally {
            spinner.hide();
            btn.prop('disabled', false);
        }
    });

    $('#logoutBtn').on('click', () => { dataCiteClient = null; updateUIForLoginState(); $('#repositoryId, #password').val(''); });

    // --- DOI Manager Tab ---
    $('#btnFetchDois').on('click', async function() {
        if (!dataCiteClient) dataCiteClient = new DataCite({ apiBaseUrl: $('#api_base').val() });
        const btn = $(this);
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Fetching...');
        const statusElem = $('#fetchStatus');
        statusElem.text('Fetching data...');
        try {
            const doiGenerator = dataCiteClient.getDoisGenerator({
                prefix: $('#filter_prefix_select').val() || null,
                query: $('#filter_query').val().trim() || null,
                fields : 'id,titles,url,state'
            });
            const allDois = [];
            for await (const doi of doiGenerator) {
                allDois.push(doi);
                statusElem.text(`Fetching... found ${allDois.length} DOIs.`);
            }
            populateMainResultsTable(allDois);
            $('#downloadDisplayedSection').toggle(allDois.length > 0);
            statusElem.text(`Successfully fetched ${allDois.length} DOIs.`);
        } catch (error) { statusElem.text(`Error: ${error.message}`);
        } finally { btn.prop('disabled', false).text('Fetch DOIs'); }
    });

    const populateMainResultsTable = (data) => {
        if (mainDataTable) mainDataTable.destroy();
        $('#doisTable').empty();
        mainDataTable = $('#doisTable').DataTable({
            data: data,
            columns: [
                { title: 'DOI', data: 'id', render: (d,t,r) => {
                        const baseUrl = dataCiteClient.apiBaseUrl.includes('test') ? 'https://doi.test.datacite.org/dois' : 'https://doi.datacite.org/dois';
                        return `<a href="${baseUrl}/${encodeURIComponent(d)}" target="_blank" class="doi-link">${d}</a>`;
                    }},
                { title: 'Title', data: 'attributes.titles', render: (d,t,r) => {
                        const title = d?.[0]?.title || '(No Title)';
                        const url = r.attributes?.url;
                        return url ? `<a href="${url}" target="_blank">${title}</a>` : title;
                    }},
                { title: 'Status', data: 'attributes.state', name: 'status', className: 'text-center', render: (d) => {
                        return genStatusIcon(d);
                    }},
                { title: 'Settings', data: null, orderable: false, className: 'text-center settings-icons', render: (d,t,r) => {
                        const doi = r.id;
                        const state = r.attributes.state;
                        const deleteBtn = state === 'draft' ? `<button class="btn btn-sm btn-danger delete-btn" data-doi="${doi}" title="Delete Draft"><i class="bi bi-trash"></i></button>` : '';
                        return `
                        <div class="btn-group btn-group-sm">
                        ${deleteBtn}
                        <button class="btn btn-sm btn-info status-btn" data-doi="${doi}" data-state="${state}" title="Change Status"><i class="bi bi-toggles"></i></button>
                        <button class="btn btn-sm btn-secondary edit-json-btn" data-doi="${doi}" title="Edit JSON"><i class="bi bi-file-earmark-code"></i></button>
                        <button class="btn btn-sm btn-secondary edit-xml-btn" data-doi="${doi}" title="Edit XML"><i class="bi bi-file-earmark-text"></i></button>
                        </div>
                    `;
                    }}
            ],
            columnDefs: [{targets: 2,orderData: [2],type: 'string'}],
            pageLength: 25, destroy: true, language: { search: "Filter results:" }
        });
    };
    // Delegated event handlers for table buttons
    $(document).on('click', '.delete-btn', function() {
        const doi = $(this).data('doi');
        const $table = $(this).closest('table');
        if ($table) {
            $('#deleteModalDoi').text(doi);
            $('#deleteModalConfirmBtn').data({doi: doi, tableId: $table.attr('id')});
            new bootstrap.Modal($('#deleteModal')).show();
        }
    });

    $('#deleteModalConfirmBtn').on('click', async function() {
        const doi = $(this).data('doi');
        const tableId = $(this).data('tableId');
        const dt = getDataTableById(tableId);
        try {
            await dataCiteClient.deleteDoi(doi);
            alert(`DOI ${doi} deleted successfully.`);
            if (dt) {
                dt.row($(`button[data-doi="${doi}"]`).closest('tr')).remove().draw();
            }
        } catch(e) { alert(`Error deleting DOI: ${e.message}`); }
        bootstrap.Modal.getInstance($('#deleteModal')).hide();
    });

    $(document).on('click', '.status-btn', function() {
        const doi = $(this).data('doi');
        const state = $(this).data('state');
        const $table = $(this).closest('table');
        $('#statusModalDoi').text(doi);
        $('#statusModalUpdateBtn').data({doi: doi, tableId: $table.attr('id'), state: state});
        const select = $('#statusModalSelect');
        select.empty();
        select.append('<option value="publish">Publish</option>');
        select.append('<option value="register">Register</option>');
        if (state === 'draft') {
            select.append('<option value="hide" selected>Hide</option>');
        } else if (state === 'registered') {
            select.val("register");
        } else if (state === 'findable') {
            select.find('option:contains("Register")').val('hide');
            select.val("publish");
        }
        new bootstrap.Modal($('#statusModal')).show();
    });

    $('#statusModalUpdateBtn').on('click', async function() {
        const doi = $(this).data('doi');
        const state = $(this).data('state');
        const tableId = $(this).data('tableId');
        const dt = getDataTableById(tableId);
        let event = $('#statusModalSelect').val();
        try {
            await dataCiteClient.updateDoiStatus(doi, event);
            alert(`Status for ${doi} updated successfully.`);
            if (dt) {
                const row = dt.row($(`button[data-doi="${doi}"]`).closest('tr'));
                if (state === "findable" && event === "hide") event = "register";
                dt.cell(row, dt.column('status:name')).data(genStatusIcon(event)).draw(false);
            }
        } catch(e) { alert(`Error updating status: ${e.message}`); }
        bootstrap.Modal.getInstance($('#statusModal')).hide();
    });

    async function openEditor(doi, type) {
        const modal = new bootstrap.Modal($('#editorModal'));
        $('#editorModalLabel').text(`Edit ${type.toUpperCase()} for ${doi}`);
        $('#editor-modal-content').val('Loading...');
        $('#editorUpdateBtn').data({doi: doi, type: type});
        modal.show();
        try {
            const data = await dataCiteClient.getDoi(doi, type === 'json' ? 'json_attributes' : 'xml');
            $('#editor-modal-content').val(type === 'json' ? JSON.stringify(data, null, 2) : data);
        } catch (e) {
            $('#editor-modal-content').val(`Error loading data: ${e.message}`);
        }
    }

    $(document).on('click', '.edit-json-btn', function() { openEditor($(this).data('doi'), 'json'); });
    $(document).on('click', '.edit-xml-btn', function() { openEditor($(this).data('doi'), 'xml'); });

    $('#editorCopyBtn').on('click', function() {
        navigator.clipboard.writeText($('#editor-modal-content').val()).then(() => alert('Copied to clipboard!'));
    });

    $('#editorUpdateBtn').on('click', async function() {
        const doi = $(this).data('doi');
        const type = $(this).data('type');
        const content = $('#editor-modal-content').val();
        try {
            if (type === 'json') {
                await dataCiteClient.updateDoiAttributes(doi, JSON.parse(content));
            } else {
                await dataCiteClient.updateDoiWithXml(doi, content);
            }
            alert(`DOI ${doi} updated successfully. Table will refresh on next fetch.`);
            bootstrap.Modal.getInstance($('#editorModal')).hide();
        } catch (e) {
            alert(`Error updating DOI: ${e.message}`);
        }
    });

    $('#btnDownloadDisplayedDois').on('click', function() {
        if (!dataCiteClient || !mainDataTable) return;
        const data = mainDataTable.rows({ search: 'applied' }).data().toArray();
        const doiList = data.map(row => row.id);
        if (doiList.length === 0) { alert("No DOIs in table to download."); return; }

        if (doiList.length > 100) {
            $('#downloadConfirmCount').text(doiList.length);
            const downloadModal = new bootstrap.Modal($('#downloadConfirmModal'));
            $('#proceedDownloadBtn').off('click').on('click', () => {
                downloadModal.hide();
                performDownload(doiList);
            });
            downloadModal.show();
        } else {
            performDownload(doiList);
        }
    });

    async function performDownload(doiList) {
        let format = $('#list_download_format').val();

        const statusElem = $('#fetchStatus');
        statusElem.text('');
        const statusCallback = createStatusCallback(statusElem);
        try {
            await dataCiteClient.downloadDoisAsZip({ doiList, outputFormat: format, statusCallback });
        } catch(e) {
            statusCallback(`\n--- DOWNLOAD ERROR ---\n${e.message}\n`);
        }
    }

    // --- Upload Manager Tab ---
    $('#upload_files_input').on('change', function() {
        $('#start_upload_btn').prop('disabled', this.files.length === 0);
    });

    $('#start_upload_btn').on('click', async function() {
        if (!dataCiteClient) { alert("Please log in first."); return; }

        const btn = $(this);
        const fileList = $('#upload_files_input')[0].files;
        const event = $('#upload_event_select').val() || null;
        if (fileList.length === 0) { alert("Please select files to upload."); return; }

        btn.prop('disabled', true);
        const statusElem = $('#upload_status_log');
        const resultsArea = $('#upload_results_area');
        resultsArea.hide();
        statusElem.text('');
        const statusCallback = createStatusCallback(statusElem);
        try {
            const results = await dataCiteClient.uploadDoisFromFiles({ fileList, statusCallback, event });
            if (results.length > 0) {
                populateResultsTable(results);
                resultsArea.show();
            }
        } catch(e) {
            statusCallback(`\n--- FATAL ERROR ---\n${e.message}\n`, 'danger');
        } finally {
            btn.prop('disabled', false);
        }
    });

    function populateResultsTable(processedDois) {
        if (uploadResultsTable) {
            uploadResultsTable.destroy();
        }
        $('#upload_results_table').empty();

        uploadResultsTable = $('#upload_results_table').DataTable({
            data: processedDois,
            columns: [
                {
                    title: "Processed DOI",
                    data: "doi",
                    render: (data) => {
                        const baseUrl = dataCiteClient.apiBaseUrl.includes('test') ? 'https://doi.test.datacite.org/dois' : 'https://doi.datacite.org/dois';
                        return `<a href="${baseUrl}/${encodeURIComponent(data)}" target="_blank" class="doi-link">${data}</a>`;
                    }
                },
                { title: "Final Status", data: "status" },
                { title: 'Settings', data: null, orderable: false, className: 'text-center settings-icons', render: (d,t,r) => {
                        const doi = r.doi;
                        return `<div class="btn-group btn-group-sm">
                            <button class="btn btn-sm btn-secondary edit-json-btn" data-doi="${doi}" title="Edit JSON"><i class="bi bi-file-earmark-code"></i></button>
                            <button class="btn btn-sm btn-secondary edit-xml-btn" data-doi="${doi}" title="Edit XML"><i class="bi bi-file-earmark-text"></i></button>
                            </div>`;
                    }}
            ],
            pageLength: 25,
            destroy: true,
            language: { search: "Filter results:" }
        });
    }

    // --- Advanced Batch Update Event Handlers ---
    /**
     * Reads all defined operation blocks from the UI and builds the 'updates' array.
     * This array is the direct input for the DataCite class method.
     * @returns {Array<object>} An array of update operation objects.
     */
    function setOpUpdates() {
        const updates = [];
        // Iterate over each operation block the user has added to the UI.
        $('#adv_batch_operations_container .operation-block').each(function() {
            const op = {};
            op.attribute = $(this).find('[name="attribute"]').val().trim();
            op.pattern = $(this).find('[name="pattern"]').val() || null; // Use null if empty

            // The replacement value can be a string or a valid JSON object/array.
            const replacementStr = $(this).find('[name="replacement"]').val();
            const replacementTrim = replacementStr.trim();
            try {
                // If it looks like JSON and parses correctly, use the parsed object.
                // Otherwise, use it as a string.
                op.replacement = (replacementTrim.startsWith('{') && replacementTrim.endsWith('}')) || (replacementTrim.startsWith('[') && replacementTrim.endsWith(']'))
                    ? JSON.parse(replacementTrim)
                    : replacementStr;
            } catch (e) {
                // If JSON parsing fails, just treat it as a plain string.
                op.replacement = replacementStr;
            }

            // Check if conditional fields are visible and filled.
            const conditionBlock = $(this).find('.condition-fields');
            if (conditionBlock.is(':visible')) {
                const condition_attribute = conditionBlock.find('[name="condition_attribute"]').val().trim();
                const condition_pattern = conditionBlock.find('[name="condition_pattern"]').val().trim();
                if (condition_attribute && condition_pattern) {
                    op.condition_attribute = condition_attribute;
                    op.condition_pattern = condition_pattern;
                }
            }

            // Only add the operation to the list if the essential 'attribute' field is defined.
            if (op.attribute) {
                updates.push(op);
            }
        });
        return updates;
    }

    /**
     * Validates that all defined operation blocks have the minimum required fields.
     * @returns {boolean} True if all operations are valid, false otherwise.
     */
    function validateOpUpdates() {
        let isValid = true;
        $('#adv_batch_operations_container .operation-block').each(function(index) {
            const attribute = $(this).find('[name="attribute"]').val().trim();
            const replacement = $(this).find('[name="replacement"]').val().trim();
            const condition_attribute = $(this).find('[name="condition_attribute"]').val().trim();
            const condition_pattern = $(this).find('[name="condition_attribute"]').val().trim();
            const pattern = $(this).find('[name="pattern"]').val().trim();

            // An operation is valid if it has an attribute and either a replacement or a condition
            if (!attribute) {
                alert(`Operation ${index + 1} is invalid. Please ensure "Attribute to Modify" is filled out.`);
                isValid = false;
                return false; // Exit the .each() loop
            }
            if (condition_pattern && condition_attribute === '') {
                alert(`Operation ${index + 1} is invalid. Please ensure "Condition Attribute" is filled out.`);
                isValid = false;
                return false;
            }
            if (!pattern) {
                let replaceText = '';
                if (replacement === '') {
                    replaceText = `DELETE EVERYTHING?\n\n` +
                        `Attribute: "${attribute}"\n` +
                        `Empty replacement = delete everything\n\n` +
                        `OK: Delete content of the Attribute\n` +
                        `Cancel: Enter pattern or replacement`;
                } else {
                    replaceText = `REPLACE ENTIRE VALUE?\n\n` +
                        `Attribute: "${attribute}"\n` +
                        `Replacement: "${replacement}"\n\n` +
                        `OK: Replace content of the Attribute\n` +
                        `Cancel: Enter pattern to be more specific`;
                }
                const confirmed = confirm( `⚠️ PATTERN IS EMPTY\n\n${replaceText}`);
                if (!confirmed) {
                    // User cancelled - focus on pattern field
                    $(this).find('[name="pattern"]').focus().select();
                    isValid = false;
                    return false;
                }
            }
            // for the "extract and set" case where replacement is intentionally empty.
            if (replacement === '' && !condition_attribute) {
                // If replacement is empty - show confirmation dialog
                const patternText = pattern ? `"${pattern}"` : `Content of the Attribute "${attribute}"`;

                const confirmed = confirm(
                    `⚠️ REPLACEMENT IS EMPTY\n\n` +
                    `You are about to delete ${patternText}.\n\n` +
                    `• All matches will be removed completely\n` +
                    `• This action cannot be undone\n\n` +
                    `Press OK to confirm Deletion\n` +
                    `Press Cancel to enter Replacement Value`
                );
                if (!confirmed) {
                    // User cancelled - focus on replacement field
                    $(this).find('[name="replacement"]').focus().select();
                    isValid = false;
                    return false;
                }
            }
            if (["state","event"].includes(attribute.toLowerCase()) && !["draft","registered","findable"].includes(pattern.toLowerCase())) {
                alert(`Operation ${index + 1} of "State" is invalid. The field "Pattern" must be either draft or registered or findable.`);
                isValid = false;
                return false;
            }
        });
        return isValid;
    }

    /**
     * @param {object} results - The results object from `batchUpdateAttributesByRegex`.
     * @param {string[]} results.updatedOnApi - List of successfully updated DOI IDs.
     * @param {string[]} results.failedOnApi - List of failed DOI IDs.
     * @param {string[]} results.affectedDois - Dry Run: List of affected DOI IDs.
     */
    function populateBUResultsTable(results) {
        const resultsContainer = $('#adv_batch_results_area');
        resultsContainer.show();

        if ($.fn.DataTable.isDataTable('#adv_batch_results_table')) {
            buResultsDataTable.clear().destroy();
            $('#adv_batch_results_table').empty();
        }

        const tableData = [];
        // Combine successful and failed DOIs into a single list for the table.
        (results.updatedOnApi || []).forEach(doi => tableData.push({ doi: doi, status: 'Success' }));
        (results.failedOnApi || []).forEach(doi => tableData.push({ doi: doi, status: 'Failed' }));
        (results.affectedDois || []).forEach(doi => tableData.push({ doi: doi, status: 'Would be updated' }));

        if (tableData.length === 0) {
            // Don't show an empty table if there were no updates or failures to report.
            resultsContainer.find('h6:contains("Affected DOIs")').hide();
            $('#adv_batch_results_table_wrapper').hide();
            return;
        }

        resultsContainer.find('h6:contains("Affected DOIs")').show();

        buResultsDataTable = $('#adv_batch_results_table').DataTable({
            data: tableData,
            columns: [
                {
                    data: "doi",
                    title: 'Processed DOI',
                    render: (data) => {
                        const baseUrl = dataCiteClient.apiBaseUrl.includes('test') ? 'https://doi.test.datacite.org/dois' : 'https://doi.datacite.org/dois';
                        return `<a href="${baseUrl}/${encodeURIComponent(data)}" target="_blank" class="doi-link">${data}</a>`;
                    }
                },
                {
                    data: 'status',
                    title: 'Final Status',
                    render: function(data) {
                        // Use Bootstrap badges for a clear visual status.
                        const badgeClass = data === 'Success' ? 'bg-success' : 'bg-danger';
                        return `<span class="badge ${badgeClass}">${data}</span>`;
                    }
                },
                { title: 'Settings', data: null, orderable: false, className: 'text-center settings-icons', render: (d,t,r) => {
                        const doi = r.doi;
                        return `<div class="btn-group btn-group-sm">
                            <button class="btn btn-sm btn-secondary edit-json-btn" data-doi="${doi}" title="Edit JSON"><i class="bi bi-file-earmark-code"></i></button>
                            <button class="btn btn-sm btn-secondary edit-xml-btn" data-doi="${doi}" title="Edit XML"><i class="bi bi-file-earmark-text"></i></button>
                            </div>`;
                    }}
            ],
            pageLength: 10,
            destroy: true,
            order: [[1, 'desc']] // Show failed items first by default for easier review.
        });
    }

    // --- Event Handlers for Advanced Batch Update ---

    // This is your main button to start the process.
    $('#adv_batch_start_btn').on('click', function() {
        if (!dataCiteClient || !dataCiteClient._authenticated) {
            alert("Please log in with an authenticated client first.");
            return;
        }
        // First, validate the user's input in the operation blocks.
        if (!validateOpUpdates()) {
            return; // Stop if validation fails.
        }

        const dryRun = $('#adv_batch_dry_run').is(':checked');

        // For a live run, we must show a confirmation modal first.
        if (!dryRun) {
            const prefix = $('#adv_batch_prefix_select').val() || 'All';
            const query = $('#adv_batch_query').val().trim() || 'None';
            // Populate the modal with a summary of the planned operation.
            $('#confirmation-summary').html(
                `<p><strong>Prefix:</strong> ${prefix}</p>` +
                `<p><strong>Query:</strong> ${query}</p>` +
                `<p><strong>Operations to perform:</strong> ${$('#adv_batch_operations_container .operation-block').length}</p>` +
                `<p class="text-danger mt-3"><strong>You are about to perform a LIVE run. Changes will be permanent.</strong></p>`
            );
            // Show the modal.
            new bootstrap.Modal($('#confirmation-modal')).show();
        } else {
            // If it's just a dry run, we can execute immediately without confirmation.
            executeBatchUpdate();
        }
    });

    // This button is inside the confirmation modal.
    $('#confirm-live-run-btn').on('click', function() {
        // Hide the modal and proceed with the live run.
        bootstrap.Modal.getInstance($('#confirmation-modal')).hide();
        executeBatchUpdate();
    });

    // Listen for checkbox state changes
    $('#adv_batch_dry_run').on('change', function() {
        if ($(this).is(':checked')) {
            // Hide the button when checkbox is OFF
            $('#btnUpdateContainer').hide();
        } else {
            // Show the button when checkbox is ON
            $('#btnUpdateContainer').show();
        }
    });

    /**
     * This is the core execution function, called for both dry and live runs.
     * It gathers all data from the UI and calls the DataCite class method.
     */
    async function executeBatchUpdate() {
        const prefix = $('#adv_batch_prefix_select').val() || null;
        const query = $('#adv_batch_query').val().trim() || null;
        const dryRun = $('#adv_batch_dry_run').is(':checked');
        const updates = setOpUpdates(); // Gathers the operation rules from the UI.

        // This check is a safeguard, but validateOpUpdates should prevent this.
        if (updates.length === 0) {
            alert("Please define at least one valid update operation.");
            return;
        }

        const statusElem = $('#adv_batch_status');
        const resultsArea = $('#adv_batch_results_area');

        // Reset UI for the new run.
        resultsArea.hide();
        statusElem.text('Starting process...').removeClass().addClass('alert alert-info');
        const statusCallback = createStatusCallback(statusElem);
        try {
            // Call the main class method with all the parameters from the UI.
            const results = await dataCiteClient.batchUpdateAttributesByRegex({
                updates,
                prefix,
                query,
                dryRun,
                statusCallback
            });

            // After the method finishes, populate the final summary and results table.
            $('#adv_batch_final_summary').text(
                // Use the length of the new result arrays for the summary.
                `DOIs Checked: ${results.checked}\n` +
                `DOIs Changed (In Memory): ${results.changedInMemory}\n` +
                `DOIs Successfully Updated on API: ${results.updatedOnApi.length}\n` +
                `DOIs Failed to Update on API: ${results.failedOnApi.length}`
            );

            // using the detailed lists returned from the class method.
            populateBUResultsTable(results);

        } catch(e) {
            // Catch any fatal errors that might occur during the process.
            statusCallback(`\n--- FATAL ERROR ---\n${e.message}\n`, 'danger');
            console.error("Fatal error during batch update execution:", e);
        }
    }

    $('#btnUpdateContainer').on('click', async function() {
        if (!dataCiteClient || !dataCiteClient._authenticated) {
            alert("Please log in with an authenticated client first.");
            return;
        }
        const dryRun = $('#adv_batch_dry_run').is(':checked');
        if (!dryRun) {
            const btn = $(this);
            btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Updating...');
            $('#adv_batch_start_btn').prop('disabled', true);
            try {
                const results = await updateContainer();
                $('#adv_batch_final_summary').text(
                    // Use the length of the new result arrays for the summary.
                    `DOIs Checked: ${results.checked}\n` +
                    `DOI Container Successfully Updated: ${results.updatedOnApi.length}\n` +
                    `DOIs Failed to Update on API: ${results.failedOnApi.length}`
                );
                populateBUResultsTable(results);
            } catch (error) {
                $('#adv_batch_status').text(`Error: ${error.message}`);
            } finally {
                btn.prop('disabled', false).text('Update Container');
                $('#adv_batch_start_btn').prop('disabled', false);
            }
        }
    });
    // --- Update Container ---
    // This function works around a known DataCite API bug where the "container" field
    // is only properly refreshed when an XML upload occurs.
    // To ensure a valid update, the process for each DOI is:
    //   1. Clear the container field (set to empty object)
    //   2. Retrieve the current DOI record in XML format
    //   3. Re-upload the XML to trigger the container refresh
    // Each step reports progress through the provided statusCallback function.
    async function updateContainer() {
        const results = {checked: 0, changedInMemory: 0, updatedOnApi: [], failedOnApi: [], affectedDois: []};
        const statusElem = $('#adv_batch_status');
        statusElem.text('Starting container update process...').removeClass().addClass('alert alert-info');
        const statusCallback = createStatusCallback(statusElem);
        const doiGenerator = dataCiteClient.getDoisGenerator({
            prefix: $('#adv_batch_prefix_select').val() || null,
            query: $('#adv_batch_query').val().trim() || null,
            fields: 'id'
        });
        for await (const row of doiGenerator) {
            results.checked++;
            const doi = row.id;
            statusCallback(`Processing DOI: ${doi}\n`);
            try {
                // Step 1: Clear the container field
                await dataCiteClient.updateDoiAttributes(doi, { container: {} });
                statusCallback(`☑ Container cleared! `,'info');

                // Step 2: Download DOI metadata as XML
                const xmlString = await dataCiteClient.getDoi(doi, 'xml');
                statusCallback(`☑ XML downloaded! `,'primary');

                // Step 3: Re-upload the XML to refresh the container
                await dataCiteClient.updateDoiWithXml(doi, xmlString);
                statusCallback(`☑ XML re-uploaded (container refreshed).\n`,'success');
                results.updatedOnApi.push(doi);
                results.changedInMemory++;
            } catch (error) {
                statusCallback(`  -> FAILED to update ${doi}: ${error.message}\n`,'danger');
                results.failedOnApi.push(doi);
            }
        }
        if (results.checked==0) {
            statusCallback("No more data found.\n", 'warning');
        }
        return results;
    }

    function addOperationBlock() {
        const newBlock = $('#operation-block-template .operation-block').clone();
        const opCount = $('#adv_batch_operations_container .operation-block').length + 1;
        newBlock.find('.operation-title').text(`Operation ${opCount}`);
        $('#adv_batch_operations_container').append(newBlock);
        // Initialize popovers on new elements
        newBlock.find('[data-bs-toggle="popover"]').each(function() {
            new bootstrap.Popover(this, { trigger: 'hover', container: 'body' }); // Use body container to avoid layout issues
        });
    }

    $('#adv_batch_add_op_btn').on('click', addOperationBlock);

    $('#adv_batch_operations_container').on('click', '.remove-op-btn', function() {
        $(this).closest('.operation-block').remove();
        $('#adv_batch_operations_container .operation-block').each(function(index) {
            $(this).find('.operation-title').text(`Operation ${index + 1}`);
        });
    });

    $('#adv_batch_operations_container').on('click', '.toggle-condition-btn', function() {
        const $conditionBtn = $(this);
        const $conditionFields = $(this).closest('.operation-block').find('.condition-fields');
        $conditionFields.slideToggle(400, function() {
            $conditionBtn.text($(this).is(":hidden") ? 'Add Condition' : 'Remove Condition');
        });
    });

    // A generic callback function to stream progress messages from the class method to the UI.
    function createStatusCallback(statusElem) {
        return function (message, type = 'muted') {
            const colorClass = `text-${type}`; // e.g., text-success, text-danger
            // Append message and auto-scroll the pre element.
            statusElem.append($('<span>').addClass(colorClass).text(message));
            statusElem.scrollTop(statusElem[0].scrollHeight);
        };
    }

    // --- Initialize UI ---
    initBootstrapComponents();
    updateUIForLoginState();
});
