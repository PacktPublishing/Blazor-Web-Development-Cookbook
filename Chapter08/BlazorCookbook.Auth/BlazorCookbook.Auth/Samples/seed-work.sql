/*

this migration seeds your identity database with data required to execute Chapter 08 recipes
of Blazor Web Development Cookbook by Pawel Bazyluk

make sure you select your intended database before executing the code below
WARNING: your existing data will be removed to avoid conflicts

you will create 4 accounts:
	admin@packt.com, in role Admin
	support@packt.com, in role Support
	user@packt.com, in role User
	user@annonymous.com, in role User

all 4 accounts use the same password
	Packt123!

*/

delete from AspNetUserRoles;
delete from AspNetUsers;
delete from AspNetRoles;

declare @password nvarchar(max)
	= 'AQAAAAIAAYagAAAAEFt7RsY3+EqyypVJP5eON3sREDdArXAJdUGQ+8RA3yHmRg1MGbqRJNWLWkqsKXR/VQ==';

declare @roles table (Id uniqueidentifier, [Name] nvarchar(50));
insert into @roles
values
	('345A9DA4-4959-4ED8-BF83-D4F747CACE05', 'Admin'),
	('55E1EE5A-024B-41AB-B130-D1FB088234BF', 'Support'),
	('92EDB3E8-8373-4A23-90B5-575D8B8B3182', 'User');

insert into AspNetRoles
	(Id, [Name], NormalizedName, ConcurrencyStamp)
select
	Id, [Name], upper([Name]), newid()
from @roles;

declare @users table (Id uniqueidentifier, [User] nvarchar(150), [Stamp] nvarchar(50));
insert into @users
values
	('48e4dcd8-091b-4683-9f0d-163fcc8af8bb', 'user@packt.com', 'VE2NTFN7OW7FHQXZEF7FHQAWOFUQIZCN'),
	('7a092c54-4046-4311-a300-d6501296ca15', 'admin@packt.com', 'RUYRDBLIN25ZLOMNQ2O5S3KLTHCCJ75V'),
	('a3f922da-2903-42cc-9885-d69e986606a8', 'support@packt.com', 'P4TXPC6DEQEBZ7MBZRTMGZDVZAIFCJIF'),
	('7178ee03-b961-42ff-833a-3680590c83ca', 'user@annonymous.com', 'P548TXPC6DEQEBZ7MBZRTMGAFDSGWERG');

insert into AspNetUsers
	(Id, UserName, NormalizedUserName, Email, NormalizedEmail, EmailConfirmed, PasswordHash, SecurityStamp, ConcurrencyStamp, PhoneNumberConfirmed, TwoFactorEnabled, LockoutEnabled, AccessFailedCount)
select
	Id, [User], upper([User]), [User], upper([User]), 1, @password, [Stamp], newid(), 0, 0, 1, 0
from @users;

insert into AspNetUserRoles
	(UserId, RoleId)
values
	('7a092c54-4046-4311-a300-d6501296ca15', '345A9DA4-4959-4ED8-BF83-D4F747CACE05'),
	('a3f922da-2903-42cc-9885-d69e986606a8', '55E1EE5A-024B-41AB-B130-D1FB088234BF'),
	('48e4dcd8-091b-4683-9f0d-163fcc8af8bb', '92EDB3E8-8373-4A23-90B5-575D8B8B3182'),
	('7178ee03-b961-42ff-833a-3680590c83ca', '92EDB3E8-8373-4A23-90B5-575D8B8B3182');

select * from AspNetUsers;
select * from AspNetRoles;
select * from AspNetUserRoles;
