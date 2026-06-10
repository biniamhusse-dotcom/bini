# -*- coding: utf-8 -*-
{
    'name': "GondarCares",

    'summary': """
        Short (1 phrase/line) summary of the module's purpose, used as
        subtitle on modules listing or apps.openerp.com""",

    'description': """
        Long description of module's purpose
    """,

    'author': "University of Gondar",
    'website': "http://uog.edu.et",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/10.0/odoo/addons/base/module/module_data.xml
    # for the full list
    'category': 'Sales',
    'version': '0.1',
    'sequence': 1,
    # any module necessary for this one to work correctly
    'depends': ['stock', 'bahmni_product', 'bahmni_account', 'sale'],

    # always loaded
    'data': [
        'views/company_profile_views.xml',
        'views/payment_methods_detail_view.xml',
        'views/gondar_cares_setting_view.xml',
    ],
    'images': ['uog_care/static/img/logo.png'],
    'installable': True,
    'application': True,
    'auto_install': False,
}