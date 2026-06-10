# -*- coding: utf-8 -*-

from odoo import models, fields

class CbhiWoredas(models.Model):
    _name = 'cbhi.woreda' 

    name = fields.Char(string='Woreda Name')
        
class CreditCompanys(models.Model):
    _name = 'credit.company' 

    name = fields.Char(string='Company Name')


class EthiopiaBrigades(models.Model):
    _name = 'ethiopia.brigade' 

    name = fields.Char(string='Brigade Name')

class UogCampus(models.Model):
    _name = 'uog.campus' 

    name = fields.Char(string='Campus Name')
    
class Workingplaces(models.Model):
    _name = 'working.place' 

    name = fields.Char(string='Workplace')

class CreditTypes(models.Model):
    _name = 'credit.type' 

    name = fields.Char(string='Credit Type')

class FreeServices(models.Model):
    _name = 'free.service' 

    name = fields.Char(string='Free Service')                 

class PaymentMethod(models.Model):
    _name = 'payment.method'

    name = fields.Char(string='Payment Method')    