/* eslint-disable no-jquery/no-global-selector */
/* eslint-disable no-jquery/no-sizzle */
const MsCatSelect = {

	selectedCat: '',
	latestDropDown: '',

	mainCategories: mw.config.get('wgMSCS_MainCategories') || [],
	useNiceDropdown: mw.config.get('wgMSCS_UseNiceDropdown') || false,
	warnNoCategories: mw.config.get('wgMSCS_WarnNoCategories') || [],
	warnNoCategoriesException: mw.config.get('wgMSCS_WarnNoCategoriesException') || [],

	// Maximum category length (matches PHP limit)
	maxCategoryLength: 255,

	init: function () {
		MsCatSelect.createArea();
		$('#editform').on('submit', MsCatSelect.checkCategories);
	},

	createArea: function () {
		const $row1 = $('<div>').addClass('row row1');
		$('<span>').addClass('label maincat').text(mw.msg('mscs-title')).appendTo($row1);
		MsCatSelect.createDropDown('', 0).appendTo($row1);
		$('<div>').attr('id', 'mscs_subcat_0').addClass('subcat').appendTo($row1);

		$('<div>').attr('id', 'mscs_add').addClass('addcat').on('click', () => {
			MsCatSelect.addCat(MsCatSelect.sanitizeCategory(MsCatSelect.selectedCat), '');
		}).text(mw.msg('mscs-add')).appendTo($row1);

		const $row2 = $('<div>').addClass('row row2');
		$('<span>').addClass('label').text(mw.msg('mscs-untercat')).appendTo($row2);
		const $newCatInput = $('<input>').attr({
			class: 'input',
			type: 'text',
			id: 'newCatInput',
			size: 30,
		}).appendTo($row2);

		$('<div>').attr('id', 'mscs_add_untercat').addClass('addcat').on('click', () => {
			MsCatSelect.createNewCat($newCatInput.val(), MsCatSelect.selectedCat);
		}).text(mw.msg('mscs-go')).appendTo($row2);

		const $row3 = $('<div>').addClass('row row3');
		$('<span>').addClass('untercat-hinw').text('(' + mw.msg('mscs-untercat-hinw') + ')').appendTo($row2);
		$('<span>').addClass('label').text(mw.msg('mscs-cats')).appendTo($row3);
		$('<div>').attr('id', 'mscs-added').appendTo($row3);

		const $div = $('<div>').attr('id', 'MsCatSelect').append($row1, $row2, $row3);
		$div.insertBefore('.editButtons');

		if (MsCatSelect.mainCategories.length && MsCatSelect.useNiceDropdown) {
			$('#mscs_dd_0').chosen();
		}

		MsCatSelect.getPageCats();
	},

	// Sanitize category string (matches PHP)
	sanitizeCategory: function (cat) {
		if (!cat) return '';
		cat = String(cat).replace(/[\n\r\|\]]+/g, '').trim();
		return cat.substring(0, MsCatSelect.maxCategoryLength);
	},

	getUncategorizedCats: function ($dd) {
		new mw.Api().get({
			format: 'json',
			formatversion: 2,
			action: 'query',
			list: 'querypage',
			qppage: 'Uncategorizedcategories',
			qplimit: 'max'
		}).done((data) => {
			if (data?.query?.querypage?.results) {
				data.query.querypage.results.forEach((result, index) => {
					const category = result.title.split(':').slice(1).join(':');
					$('<option>').val(index + 1).text(MsCatSelect.sanitizeCategory(category)).appendTo($dd);
				});
				if (MsCatSelect.useNiceDropdown) {
					$dd.chosen({ disableSearchThreshold: 6 });
					$('#mscs_dd_0_chzn').width($dd.width() + 20);
				}
			} else if (data?.error) {
				mw.log.error(`API error: ${data.error.code} - ${data.error.info}`);
			}
		});
	},

	getSubcats: function (maincat, level, $container) {
		maincat = MsCatSelect.sanitizeCategory(maincat);
		new mw.Api().get({
			format: 'json',
			action: 'query',
			list: 'categorymembers',
			cmtitle: 'Category:' + maincat,
			cmtype: 'subcat',
			cmlimit: 'max'
		}).done((data) => {
			if (data?.query?.categorymembers) {
				if (data.query.categorymembers.length) {
					$('<div>').addClass('node').prependTo($container);
					const $dd = MsCatSelect.createDropDown(MsCatSelect.selectedCat, level + 1).appendTo($container);
					$('<div>').attr('id', 'mscs_subcat_' + (level + 1)).addClass('subcat').appendTo($container);

					data.query.categorymembers.forEach((val, index) => {
						const listElement = val.title.split(':').slice(1).join(':');
						$('<option>').val(index + 1).text(MsCatSelect.sanitizeCategory(listElement)).appendTo($dd);
					});
					if (MsCatSelect.useNiceDropdown) {
						$dd.chosen({ disableSearchThreshold: 6 });
						$('#mscs_dd_' + (level + 1) + '_chzn').width($dd.width() + 20);
					}
				} else {
					$('<div>').addClass('no-node').prependTo($('#mscs_subcat_' + level));
				}
			} else if (data?.error) {
				mw.log.error(`API error: ${data.error.code} - ${data.error.info}`);
			}
		});
	},

	createDropDown: function (maincat, level) {
		const $dd = $('<select>').attr('id', 'mscs_dd_' + level).on('change', function () {
			const $container = $('#mscs_subcat_' + level);
			$container.empty();

			if ($(this).val() !== 0) {
				MsCatSelect.selectedCat = MsCatSelect.sanitizeCategory($('option:selected', this).text());
				MsCatSelect.getSubcats(MsCatSelect.selectedCat, level, $container);
			} else if (level === 0) {
				MsCatSelect.selectedCat = '';
			} else {
				MsCatSelect.selectedCat = MsCatSelect.sanitizeCategory($('#MsCatSelect option:selected:eq(' + (level - 1) + ')').text());
			}
		});

		$('<option>').val(0).text('---').appendTo($dd);

		if (level === 0 && maincat === '') {
			if (MsCatSelect.mainCategories.length === 0) {
				MsCatSelect.getUncategorizedCats($dd);
			} else {
				MsCatSelect.mainCategories.forEach((ddValue, ddIndex) => {
					$('<option>').val(ddIndex + 1).text(MsCatSelect.sanitizeCategory(ddValue)).appendTo($dd);
				});
			}
		}
		return $dd;
	},

	addCat: function (category, sortkey) {
		category = MsCatSelect.sanitizeCategory(category);
		if (!category || category === '---') return;

		if ($('#mscs-added .mscs_entry[category="' + category + '"]').length === 0) {
			const $entry = $('<div>').addClass('mscs_entry').data('sortkey', sortkey).text(category).appendTo($('#mscs-added'));
			const $input = $('<input>').attr({
				type: 'checkbox',
				class: 'mscs_checkbox',
				name: 'SelectCategoryList[]',
				value: category + '|' + sortkey,
				checked: true
			}).prependTo($entry);

			$('<span>').addClass('img-sortkey').attr('title', sortkey).on('click', function () {
				const $sortkey = $(this);
				const oldSortkey = $entry.data('sortkey');
				OO.ui.prompt(mw.msg('mscs-sortkey'), { textInput: { value: oldSortkey } }).done((newSortkey) => {
					if (newSortkey !== null) {
						newSortkey = MsCatSelect.sanitizeCategory(newSortkey);
						$entry.data('sortkey', newSortkey);
						$input.val(category + '|' + newSortkey);
						$sortkey.attr('title', newSortkey);
					}
				});
			}).appendTo($entry);
		}
	},

	createNewCat: function (newCat, oldCat) {
		newCat = MsCatSelect.sanitizeCategory(newCat);
		oldCat = MsCatSelect.sanitizeCategory(oldCat);
		if (!newCat) return;

		const catNamespace = mw.config.get('wgFormattedNamespaces')[14];
		const catTitle = catNamespace + ':' + newCat;
		const catContent = oldCat ? '[[' + catNamespace + ':' + oldCat + ']]' : '';

		new mw.Api().post({
			action: 'edit',
			title: catTitle,
			section: 'new',
			text: catContent,
			token: mw.user.tokens.get('csrfToken'),
			createonly: true,
			format: 'json'
		}).done((data) => {
			if (data?.edit?.result === 'Success') {
				mw.notify(mw.msg('mscs-created'));
				$('#MsCatSelect #newCatInput').val('');
				MsCatSelect.addCat(newCat, '');
			} else if (data?.error) {
				mw.log.error(`API error: ${data.error.code} - ${data.error.info}`);
				if (data.error.code === 'articleexists') {
					mw.notify(data.error.info);
					$('#MsCatSelect #newCatInput').val('');
				}
			}
		});
	},

	checkCategories: function () {
		if (MsCatSelect.warnNoCategories &&
			$('#mscs-added input[type="checkbox"]:checked').length === 0 &&
			!MsCatSelect.warnNoCategoriesException.includes(mw.config.get('wgRelevantPageName')) &&
			!MsCatSelect.warnNoCategoriesException.includes(mw.config.get('wgNamespaceNumber').toString())
		) {
			return confirm(mw.msg('mscs-warnnocat'));
		}
	}
};

mw.loader.using('oojs-ui-windows', MsCatSelect.init);
