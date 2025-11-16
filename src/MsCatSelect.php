<?php

use MediaWiki\Config\Config;
use MediaWiki\EditPage\EditPage;
use MediaWiki\MediaWikiServices;
use MediaWiki\Output\OutputPage;

class MsCatSelect {

    public static function onResourceLoaderGetConfigVars(array &$vars, string $skin, Config $config) {
        $mainCategories = $config->get('MSCS_MainCategories');
        $useNiceDropdown = $config->get('MSCS_UseNiceDropdown');
        $warnNoCategories = $config->get('MSCS_WarnNoCategories');
        $warnNoCategoriesException = $config->get('MSCS_WarnNoCategoriesException');

        // Sanitize config values for JS context
        $vars['wgMSCS_MainCategories'] = is_array($mainCategories) ? array_map('strval', $mainCategories) : [];
        $vars['wgMSCS_UseNiceDropdown'] = (bool)$useNiceDropdown;
        $vars['wgMSCS_WarnNoCategories'] = is_array($warnNoCategories) ? array_map('strval', $warnNoCategories) : [];
        $vars['wgMSCS_WarnNoCategoriesException'] = is_array($warnNoCategoriesException) ? array_map('strval', $warnNoCategoriesException) : [];
    }

    /**
     * Add JS module to the edit page
     */
    public static function onShowEditFormInitial(EditPage $editPage, OutputPage $output) {
        $output->addModules('ext.MsCatSelect');
        self::cleanTextbox($editPage);
    }

    /**
     * Append selected categories safely on save
     */
    public static function onAttemptSave(EditPage $editPage) {
        $language = MediaWikiServices::getInstance()->getContentLanguage();
        $categoryNamespace = $language->getNsText(NS_CATEGORY);

        $categories = $editPage->getContext()->getRequest()->getArray('SelectCategoryList', []);

        $safeCategories = [];
        foreach ($categories as $category) {
            // Remove sortkey if empty, sanitize string
            $category = rtrim($category, '|');
            $category = self::sanitizeCategory($category);
            if ($category !== '') {
                $safeCategories[] = "[[{$categoryNamespace}:{$category}]]";
            }
        }

        if ($safeCategories) {
            $editPage->textbox1 .= "\n\n" . implode("\n", $safeCategories);
        }
    }

    /**
     * Remove old category tags from edit textbox
     */
    private static function cleanTextbox(EditPage $editPage) {
        $language = MediaWikiServices::getInstance()->getContentLanguage();
        $categoryNamespace = preg_quote($language->getNsText(NS_CATEGORY), '/');

        // Regex: match [[Category:Name|SortKey]], excluding #ask queries
        $pattern = "(?<!#ask:)\[\[{$categoryNamespace}:([^\|\]]*)(\|[^\|\]]*)?\]\]";

        $editText = $editPage->textbox1;
        $lines = explode("\n", $editText);
        $cleanLines = [];

        foreach ($lines as $line) {
            $cleanLines[] = preg_replace("/{$pattern}/i", '', $line);
        }

        $editPage->textbox1 = trim(implode("\n", $cleanLines));
    }

    /**
     * Sanitize category string to prevent malformed wikitext or injection
     */
    private static function sanitizeCategory(string $category): string {
        // Remove control chars, newlines, pipe, closing brackets
        $category = str_replace(["\n", "\r", '|', ']]'], '', $category);
        $category = trim($category);
        // Limit length to prevent very long categories
        return mb_substr($category, 0, 255);
    }
}
